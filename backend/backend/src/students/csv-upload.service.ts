
import { Injectable } from "@nestjs/common";
import { StudentsService } from "./students.service";

@Injectable()
export class CsvUploadService {
  constructor(private students: StudentsService) {}

  async processCSV(csvText: string, schoolId: string, defaults: { className: string; track: string; termLabel: string }) {
    // Parse CSV — header row required.
    // Supported columns:
    // - fullName | fullname | name (single column; e.g. "Ali Chidera Samuel")
    // - firstName/lastName (or first_name/last_name)
    // Optional: email, username, phone, className/class, track
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

    const splitFullName = (fullName: string) => {
      const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
      if (!cleaned) return { firstName: '', lastName: '' };
      const parts = cleaned.split(' ');
      if (parts.length === 1) return { firstName: parts[0], lastName: 'Student' };
      return { firstName: parts[0], lastName: parts.slice(1).join(' ') || 'Student' };
    };

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(",");
      const fullNameRaw = (col(row, "fullname") || col(row, "full_name") || col(row, "name")).trim();
      const nameFromFull = splitFullName(fullNameRaw);
      const firstName = ((col(row, "firstname") || col(row, "first_name")) || nameFromFull.firstName).trim();
      const lastName = ((col(row, "lastname") || col(row, "last_name")) || nameFromFull.lastName).trim();
      if (!firstName) continue;
      const displayName = fullNameRaw || `${firstName} ${lastName || 'Student'}`.trim();

      const emailRaw = col(row, "email").trim();
      const usernameRaw = col(row, "username").trim();

      try {
        const data = {
          schoolId,
          firstName,
          lastName: lastName || "Student",
          email: emailRaw || undefined,
          username: usernameRaw || undefined,
          phone: col(row, "phone") || undefined,
          className: col(row, "classname") || col(row, "class") || defaults.className,
          track: (col(row, "track") || defaults.track) as any,
          termLabel: defaults.termLabel,
        };

        const created = await this.students.create(data);

        results.push({
          success: true,
          row: i,
          name: displayName,
          email: data.email,
          username: (created as any).user?.username,
          regNumber: created.regNumber,
        });
      } catch (e: any) {
        const emailIdx = headers.indexOf("email");
        results.push({
          success: false,
          row: i,
          name: displayName,
          email: emailIdx >= 0 ? row[emailIdx]?.trim() : undefined,
          error: e.message,
        });
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
