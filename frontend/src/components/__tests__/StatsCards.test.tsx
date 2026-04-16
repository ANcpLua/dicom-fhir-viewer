import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatsCards } from "../StatsCards.js";
import type { StatsResponse } from "../../lib/types.js";

const SAMPLE: StatsResponse = {
  totalPatients: 2,
  totalStudies: 3,
  totalInstances: 120,
  modalityDistribution: [
    { modality: "CT", count: 2 },
    { modality: "MR", count: 1 },
  ],
  studiesByDate: [
    { date: "2024-03-15", count: 1 },
    { date: "2024-04-01", count: 2 },
  ],
};

describe("StatsCards", () => {
  it("renders every summary card with the totals from the response", () => {
    render(<StatsCards stats={SAMPLE} />);
    expect(screen.getByText("Patients").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Imaging Studies").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("Instances").nextSibling).toHaveTextContent("120");
    expect(screen.getByText("Distinct Modalities").nextSibling).toHaveTextContent("2");
  });

  it("renders both modality rows and both date rows", () => {
    render(<StatsCards stats={SAMPLE} />);
    expect(screen.getByText("CT")).toBeInTheDocument();
    expect(screen.getByText("MR")).toBeInTheDocument();
    expect(screen.getByText("2024-03-15")).toBeInTheDocument();
    expect(screen.getByText("2024-04-01")).toBeInTheDocument();
  });

  it("shows empty-state hints when there are no modalities or dated studies (negative space)", () => {
    render(
      <StatsCards
        stats={{ ...SAMPLE, modalityDistribution: [], studiesByDate: [] }}
      />,
    );
    expect(screen.getByText(/no series yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no studies yet/i)).toBeInTheDocument();
  });
});
