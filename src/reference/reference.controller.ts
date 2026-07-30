import { Controller, Get, Query } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { ReferenceService } from "./reference.service";

@Controller("reference")
export class ReferenceController {
  constructor(private reference: ReferenceService) {}

  @Get("states")
  @Public()
  getStates(@Query("countryId") countryId: string) {
    return this.reference.getStates(countryId);
  }

  @Get("courses")
  @Public()
  getCourses() {
    return this.reference.getCourses();
  }

  @Get("active-batch")
  @Public()
  getActiveBatch() {
    return this.reference.getActiveBatch();
  }

  @Get("countries")
  @Public()
  getCountries() {
    return this.reference.getCountries();
  }

  @Get("religions")
  @Public()
  getReligions() {
    return this.reference.getReligions();
  }
}
