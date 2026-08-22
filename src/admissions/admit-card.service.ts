import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, rectangle, clip, endPath, pushGraphicsState, popGraphicsState } from "pdf-lib";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

// Template PDFs are the exact designs provided for each course — see
// assets/admit-card-templates/. Resolved from process.cwd() rather than
// __dirname — __dirname points into dist/src/admissions at runtime (compiled
// build), and assets/ isn't part of the dist output, whereas Nest is always
// started from the repo root.
const TEMPLATE_DIR = join(process.cwd(), "assets", "admit-card-templates");
const TEMPLATE_FILE: Record<string, string> = {
  BSS: "BSS.pdf",
  BSJ: "BSJ.pdf",
  BSM: "BSM.pdf",
  DSC: "DSC.pdf",
};

const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0.05, 0.05, 0.05);
const RED = rgb(0.75, 0.1, 0.1);

type Box = { x: number; yTop: number; yBottom: number; width: number };
type Layout = {
  courseCode: Box;
  rollNumber: Box;
  applicationNo: Box;
  candidateName: Box;
  fatherName: Box;
  dob: Box;
  genderCategory: Box;
  discipline: Box | null;
  photoBox: { x: number; width: number; yTop: number; yBottom: number };
};

// Each box is in the PDF's native top-left-origin points (as reported by
// `pdftotext -bbox-layout`); toPageY() below flips it to pdf-lib's
// bottom-left origin. Boxes are sized generously to fully cover the baked-in
// placeholder text before the real value is drawn on top.
const PAGE_HEIGHT = 841.92;

// Shared by the 3 UG templates (BSS/BSJ/BSM) — identical layout across all
// three, only header color/course name/code differ. Re-measured against the
// "Admit Card/New/" revision (2026-08-22) via `pdftotext -bbox-layout` +
// a 300dpi pixel-ruler measurement of the photo box's actual dashed border
// (bbox only reports caption text, which sits well inside the true border).
const UG_LAYOUT: Layout = {
  courseCode: { x: 375.7, yTop: 173, yBottom: 189, width: 95 },
  rollNumber: { x: 129.1, yTop: 214, yBottom: 228, width: 140 },
  applicationNo: { x: 375.7, yTop: 214, yBottom: 228, width: 95 },
  candidateName: { x: 129.1, yTop: 241, yBottom: 270, width: 140 },
  genderCategory: { x: 375.7, yTop: 241, yBottom: 270, width: 95 },
  fatherName: { x: 129.1, yTop: 283, yBottom: 298, width: 140 },
  dob: { x: 375.7, yTop: 283, yBottom: 298, width: 95 },
  discipline: null,
  photoBox: { x: 465, width: 101, yTop: 167, yBottom: 299 },
};

// DSC's replacement template ("Admit card with discipline field") rearranges
// the whole grid — Discipline now sits beside Candidate Name (its own baked-in
// field, no manual row needed), Gender/Category moved to its own standalone
// row below, and the photo box spans only rows 1-4 (Course Applied through
// Father's Name/DOB) — the standalone Gender/Category row sits below it, full
// width, outside the box. Re-measured against the "Admit Card/New/" revision
// (2026-08-22) via `pdftotext -bbox-layout` + a 300dpi pixel-ruler measurement
// of the photo box's actual dashed border — coordinates are NOT shared with
// UG_LAYOUT.
const DSC_LAYOUT: Layout = {
  courseCode: { x: 370.9, yTop: 172, yBottom: 187, width: 90 },
  rollNumber: { x: 130.6, yTop: 200, yBottom: 216, width: 140 },
  applicationNo: { x: 370.9, yTop: 201, yBottom: 216, width: 90 },
  candidateName: { x: 130.6, yTop: 224, yBottom: 240, width: 140 },
  discipline: { x: 370.9, yTop: 224, yBottom: 240, width: 90 },
  fatherName: { x: 130.6, yTop: 247, yBottom: 263, width: 140 },
  dob: { x: 370.9, yTop: 247, yBottom: 263, width: 90 },
  genderCategory: { x: 130.6, yTop: 272, yBottom: 286, width: 200 },
  photoBox: { x: 461, width: 101, yTop: 163, yBottom: 283 },
};

const LAYOUT_BY_COURSE: Record<string, Layout> = {
  BSS: UG_LAYOUT,
  BSJ: UG_LAYOUT,
  BSM: UG_LAYOUT,
  DSC: DSC_LAYOUT,
};

function toPageY(yBottomOfBox: number): number {
  return PAGE_HEIGHT - yBottomOfBox;
}

@Injectable()
export class AdmitCardService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async generateForUser(userId: string): Promise<Buffer> {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException("Student profile not found");
    return this.generateForStudent(student.id);
  }

  async generateForAdmissionId(admissionId: string): Promise<Buffer> {
    const admission = await this.prisma.admission.findUnique({ where: { id: admissionId } });
    if (!admission) throw new NotFoundException("Admission not found");
    return this.generateForStudent(admission.studentId);
  }

  async generateForStudent(studentId: string): Promise<Buffer> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { fullName: true, dob: true, registrationNumber: true } },
        admission: { include: { parentDetails: true } },
      },
    });
    if (!student || !student.admission) throw new NotFoundException("Admission not found");
    if (!student.rollNumber) throw new NotFoundException("Roll number has not been assigned yet");
    if (!student.programme) throw new NotFoundException("Course not set on this admission");

    const course = await this.prisma.course.findUnique({ where: { name: student.programme } });
    if (!course?.code || !TEMPLATE_FILE[course.code]) {
      throw new NotFoundException("No admit card template configured for this course");
    }

    const photo = await this.prisma.document.findFirst({
      where: { admissionId: student.admission.id, type: "PHOTO" },
    });

    return this.render({
      courseCode: course.code,
      candidateName: student.user.fullName,
      fatherName: student.admission.parentDetails?.fatherName ?? "",
      gender: student.admission.gender ?? "",
      category: student.admission.category ?? "",
      dob: student.user.dob,
      rollNumber: student.rollNumber,
      applicationNo: student.user.registrationNumber ?? "",
      coachingDiscipline: student.admission.coachingDiscipline,
      photoDoc: photo,
    });
  }

  private async render(input: {
    courseCode: string;
    candidateName: string;
    fatherName: string;
    gender: string;
    category: string;
    dob: Date | null;
    rollNumber: string;
    applicationNo: string;
    coachingDiscipline: string | null;
    photoDoc: { url: string | null; data: Buffer | null; mimeType: string | null } | null;
  }): Promise<Buffer> {
    const layout = LAYOUT_BY_COURSE[input.courseCode];
    const templateBytes = await readFile(join(TEMPLATE_DIR, TEMPLATE_FILE[input.courseCode]));
    const pdf = await PDFDocument.load(templateBytes);
    const page = pdf.getPages()[0];
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const cover = (box: Box) => {
      page.drawRectangle({
        x: box.x - 1,
        y: toPageY(box.yBottom),
        width: box.width,
        height: box.yBottom - box.yTop,
        color: WHITE,
      });
    };
    const write = (box: Box, text: string, opts: { font: PDFFont; size: number; color: ReturnType<typeof rgb> }) => {
      cover(box);
      let size = opts.size;
      while (opts.font.widthOfTextAtSize(text, size) > box.width - 4 && size > 6) size -= 0.5;
      page.drawText(text, { x: box.x, y: toPageY(box.yBottom) + 3, size, font: opts.font, color: opts.color });
    };

    write(layout.courseCode, `${input.courseCode}-26`, { font: bold, size: 9, color: BLACK });
    write(layout.rollNumber, input.rollNumber, { font: bold, size: 10, color: RED });
    write(layout.applicationNo, input.applicationNo || "-", { font: bold, size: 9, color: BLACK });
    write(layout.candidateName, input.candidateName || "-", { font: regular, size: 9, color: BLACK });
    const genderCategory = [input.gender, input.category].filter(Boolean).join(" / ") || "-";
    write(layout.genderCategory, genderCategory, { font: regular, size: 9, color: BLACK });
    write(layout.dob, input.dob ? this.formatDate(input.dob) : "-", { font: regular, size: 9, color: BLACK });
    write(layout.fatherName, input.fatherName || "-", { font: regular, size: 9, color: BLACK });

    if (layout.discipline && input.coachingDiscipline) {
      write(layout.discipline, input.coachingDiscipline, { font: regular, size: 9, color: BLACK });
    }

    if (input.photoDoc) {
      await this.embedPhoto(pdf, page, layout.photoBox, input.photoDoc);
    }

    const bytes = await pdf.save();
    return Buffer.from(bytes);
  }

  private async embedPhoto(
    pdf: PDFDocument,
    page: PDFPage,
    photoBox: { x: number; width: number; yTop: number; yBottom: number },
    doc: { url: string | null; data: Buffer | null; mimeType: string | null },
  ) {
    try {
      let bytes: Buffer;
      let mimeType = doc.mimeType;
      if (doc.data) {
        bytes = doc.data;
      } else if (doc.url) {
        const signedUrl = this.storage.getReadUrl(doc.url);
        const res = await fetch(signedUrl);
        if (!res.ok) return;
        bytes = Buffer.from(await res.arrayBuffer());
        mimeType ??= res.headers.get("content-type");
      } else {
        return;
      }

      const image = mimeType?.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const { x: boxX, width: boxWidth, yTop: boxYTop, yBottom: boxYBottom } = photoBox;
      const boxHeight = boxYBottom - boxYTop;

      // White-out the whole box first — the "Affix / Printed Recent..."
      // caption baked into the template otherwise shows through around a
      // photo that doesn't exactly fill the box (most photos won't, since
      // we preserve aspect ratio rather than stretching).
      page.drawRectangle({ x: boxX - 2, y: toPageY(boxYBottom), width: boxWidth + 4, height: boxHeight, color: WHITE });
      page.drawRectangle({
        x: boxX - 2,
        y: toPageY(boxYBottom),
        width: boxWidth + 4,
        height: boxHeight,
        borderColor: rgb(0.6, 0.6, 0.6),
        borderWidth: 0.75,
        borderDashArray: [3, 2],
      });

      // "Cover" fit (scale to fill the box, clipped to it) rather than
      // "contain" — passport photos rarely match the box's aspect ratio, and
      // a contained/letterboxed image left distracting blank gaps above/below
      // inside the frame. Clip path is scoped between push/pop so it doesn't
      // affect anything drawn after the photo.
      const boxBottomY = toPageY(boxYBottom);
      const scale = Math.max(boxWidth / image.width, boxHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.pushOperators(pushGraphicsState(), rectangle(boxX, boxBottomY, boxWidth, boxHeight), clip(), endPath());
      page.drawImage(image, {
        x: boxX + (boxWidth - width) / 2,
        y: boxBottomY + (boxHeight - height) / 2,
        width,
        height,
      });
      page.pushOperators(popGraphicsState());
    } catch {
      // Photo couldn't be fetched/decoded — leave the box blank rather than
      // failing the whole admit card download.
    }
  }

  private formatDate(d: Date): string {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
}
