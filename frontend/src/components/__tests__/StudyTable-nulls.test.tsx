import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { StudyTable } from "../StudyTable.js";
import type { Study } from "../../lib/types.js";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("StudyTable — null-field em-dash coverage (every optional column)", () => {
  it("renders an em-dash for every optional field when every value is null", () => {
    const blank: Study = {
      studyInstanceUid: "1.2.3.4.5",
      patientName: null,
      patientId: null,
      patientBirthDate: null,
      patientSex: null,
      studyDate: null,
      studyDescription: null,
      accessionNumber: null,
      numberOfSeries: null,
      numberOfInstances: null,
    };

    renderWithRouter(<StudyTable studies={[blank]} />);

    // Every column should render an em-dash: patient link, patientId, date,
    // description, numberOfSeries, numberOfInstances (6 total).
    expect(screen.getAllByText("—")).toHaveLength(6);
  });

  it("still links the em-dash patient name to the Study Detail route", () => {
    const blank: Study = {
      studyInstanceUid: "1.2.3.4.5",
      patientName: null,
      patientId: null,
      patientBirthDate: null,
      patientSex: null,
      studyDate: null,
      studyDescription: null,
      accessionNumber: null,
      numberOfSeries: null,
      numberOfInstances: null,
    };

    renderWithRouter(<StudyTable studies={[blank]} />);

    const link = screen.getByRole("link", { name: "—" });
    expect(link).toHaveAttribute("href", "/studies/1.2.3.4.5");
  });
});
