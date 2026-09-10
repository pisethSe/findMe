import { Injectable } from "@nestjs/common";
import type { CreateReportDto } from "./reports.dto.js";
import { ReportsRepository } from "./reports.repository.js";
@Injectable()
export class ReportsService {
  constructor(private readonly repository: ReportsRepository) {}
  async create(reporterId: string, listingId: string, input: CreateReportDto) {
    const report = await this.repository.create(reporterId, listingId, input);
    return { data: { id: report.id, received: true as const } };
  }
}
