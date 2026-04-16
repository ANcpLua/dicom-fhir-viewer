import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TagsPanel } from "../TagsPanel.js";
import type { Instance, Series, StudyDetail } from "../../lib/types.js";

const DETAIL: StudyDetail = {
  studyInstanceUid: "1.2.3",
  patientName: "DOE^JANE",
  patientId: "PAT-1",
  patientSex: "F",
  studyDate: "20240315",
  studyDescription: "MR Brain",
  series: [],
};

const SERIES: Series = {
  seriesInstanceUid: "1.2.3.1",
  seriesNumber: 2,
  seriesDescription: "T1 SAG",
  modality: "MR",
  manufacturer: "SIEMENS",
  instances: [],
};

const INSTANCE: Instance = {
  sopInstanceUid: "1.2.3.1.1",
  sopClassUid: "1.2.840.10008.5.1.4.1.1.4",
  instanceNumber: 5,
  rows: 256,
  columns: 256,
  bitsAllocated: 16,
};

describe("TagsPanel", () => {
  it("renders every FR-VIEW-03 label with the selected instance's values", () => {
    render(<TagsPanel detail={DETAIL} series={SERIES} instance={INSTANCE} />);

    expect(screen.getByText("Patient Name").nextSibling).toHaveTextContent("DOE^JANE");
    expect(screen.getByText("Study Date").nextSibling).toHaveTextContent("2024-03-15");
    expect(screen.getByText("Modality").nextSibling).toHaveTextContent("MR");
    expect(screen.getByText("Series Description").nextSibling).toHaveTextContent("T1 SAG");
    expect(screen.getByText("Instance #").nextSibling).toHaveTextContent("5");
    expect(screen.getByText("Dimensions").nextSibling).toHaveTextContent("256 × 256");
  });

  it("formats dimensions with a '?' placeholder when only one of rows/columns is null (mixed branch)", () => {
    const mixedRows: Instance = { ...INSTANCE, rows: 256, columns: null };
    render(<TagsPanel detail={DETAIL} series={SERIES} instance={mixedRows} />);
    expect(screen.getByText("Dimensions").nextSibling).toHaveTextContent("? × 256");
  });

  it("formats dimensions with a '?' placeholder when rows is null but columns is set", () => {
    const mixedCols: Instance = { ...INSTANCE, rows: null, columns: 512 };
    render(<TagsPanel detail={DETAIL} series={SERIES} instance={mixedCols} />);
    expect(screen.getByText("Dimensions").nextSibling).toHaveTextContent("512 × ?");
  });

  it("renders em-dash for null seriesNumber (optional-chain fallback)", () => {
    const nullSeriesNumber: Series = { ...SERIES, seriesNumber: null };
    render(<TagsPanel detail={DETAIL} series={nullSeriesNumber} instance={INSTANCE} />);
    expect(screen.getByText("Series #").nextSibling).toHaveTextContent("—");
  });

  it("falls back to em-dash for every null tag (no crash)", () => {
    const emptyDetail: StudyDetail = {
      ...DETAIL,
      patientName: null,
      patientId: null,
      patientSex: null,
      studyDate: null,
      studyDescription: null,
    };
    const emptySeries: Series = { ...SERIES, modality: null, manufacturer: null, seriesDescription: null };
    const emptyInstance: Instance = {
      ...INSTANCE,
      sopClassUid: null,
      instanceNumber: null,
      rows: null,
      columns: null,
      bitsAllocated: null,
    };

    render(<TagsPanel detail={emptyDetail} series={emptySeries} instance={emptyInstance} />);

    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(8);
  });
});
