import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppShell } from "../AppShell.js";

describe("AppShell", () => {
  it("renders every nav link with a href pointing at the correct route", () => {
    render(
      <MemoryRouter initialEntries={["/studies"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="studies" element={<div>inner</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Study Browser" })).toHaveAttribute("href", "/studies");
    expect(screen.getByRole("link", { name: "FHIR Explorer" })).toHaveAttribute("href", "/fhir");
    expect(screen.getByText("inner")).toBeInTheDocument();
  });
});
