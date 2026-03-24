
import { Injectable } from "@nestjs/common";
import { StudentsService } from "./students.service";

@Injectable()
export class CsvUploadService {
  constructor(private students: StudentsService) {}

  async processCSV(csvText: string, schoolId: string, defaults: { className: string; track: string; termLabel: string }) {
    // Parse CSV — expects: firstName,lastName,email,phone,className,track
    const lines = csvText
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim());

    const col = (row: string[], name: string) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? row[idx]?.trim() || "" : "";
    };

    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");
      if (!row.length || !col(row, "email")) continue;

      try {
        const data = {
          schoolId,
          firstName: col(row, "firstname") || col(row, "first_name"),
          lastName: col(row, "lastname") || col(row, "last_name"),
          email: col(row, "email"),
          phone: col(row, "phone") || undefined,
          className: col(row, "classname") || col(row, "class") || defaults.className,
          track: (col(row, "track") || defaults.track) as any,
          termLabel: defaults.termLabel,
        };

        const student = await this.students.create(data);

        results.push({ success: true, email: data.email, regNumber: student.regNumber });
      } catch (e: any) {
        results.push({ success: false, email: row[headers.indexOf("email")]?.trim(), error: e.message });
      }
    }

    return {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }
}
