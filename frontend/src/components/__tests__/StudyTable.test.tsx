import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { StudyTable } from "../StudyTable.js";
import { formatDicomDate } from "../../lib/dicom-format.js";
import type { Study } from "../../lib/types.js";

const SAMPLE: Study = {
  studyInstanceUid: "1.2.840.113619.2.55.3.604688119.969.1268071029.320",
  patientName: "DOE^JANE",
  patientId: "PAT-001",
  patientBirthDate: null,
  patientSex: "F",
  studyDate: "20240315",
  studyDescription: "MR Brain without contrast",
  accessionNumber: "ACC-001",
  numberOfSeries: 3,
  numberOfInstances: 47,
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("StudyTable", () => {
  it("shows an explicit empty-state message when given no studies (negative space)", () => {
    renderWithRouter(<StudyTable studies={[]} />);
    expect(screen.getByText(/no studies/i)).toBeInTheDocument();
    // Table header must NOT be rendered in the empty state
    expect(screen.queryByRole("columnheader", { name: /patient/i })).toBeNull();
  });

  it("renders one row per study with the required columns from FR-BROWSE-02", () => {
    renderWithRouter(<StudyTable studies={[SAMPLE]} />);
    expect(screen.getByText("DOE^JANE")).toBeInTheDocument();
    expect(screen.getByText("PAT-001")).toBeInTheDocument();
    expect(screen.getByText("2024-03-15")).toBeInTheDocument();
    expect(screen.getByText("MR Brain without contrast")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
  });

  it("links the patient name to the Study Detail route using the StudyInstanceUID", () => {
    renderWithRouter(<StudyTable studies={[SAMPLE]} />);
    const link = screen.getByRole("link", { name: "DOE^JANE" });
    expect(link).toHaveAttribute(
      "href",
      `/studies/${encodeURIComponent(SAMPLE.studyInstanceUid)}`,
    );
  });

  it("renders em-dash placeholders when optional fields are null (no crash)", () => {
    const blank: Study = { ...SAMPLE, patientName: null, studyDate: null, numberOfSeries: null };
    renderWithRouter(<StudyTable studies={[blank]} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("omits the bottom border on the last row only (row-position branch pair)", () => {
    const second: Study = {
      ...SAMPLE,
      studyInstanceUid: "2.2.2",
      patientName: "SMITH^BOB",
      patientId: "PAT-002",
    };
    renderWithRouter(<StudyTable studies={[SAMPLE, second]} />);

    const rows = screen.getAllByRole("row");
    // rows[0] is the <thead> row; rows[1] is the first data row, rows[2] is the last.
    expect(rows[1]?.className).toContain("border-b");
    expect(rows[2]?.className).not.toContain("border-b");
  });
});

describe("formatDicomDate", () => {
  it("formats YYYYMMDD into YYYY-MM-DD", () => {
    expect(formatDicomDate("20240315")).toBe("2024-03-15");
  });
  it("passes through non-8-digit input unchanged (defensive)", () => {
    expect(formatDicomDate("2024-03-15")).toBe("2024-03-15");
  });
  it("returns em-dash for null input", () => {
    expect(formatDicomDate(null)).toBe("—");
  });
});
