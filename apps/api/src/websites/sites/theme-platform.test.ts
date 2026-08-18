import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  getThemeDefinition,
  listThemeDefinitions,
  portalModernFiles,
  validateThemeFileContent,
  validateThemeFilePath,
} from "./theme-platform.js";

describe("theme platform registry", () => {
  it("registers Portal Modern as a platform theme", () => {
    const definition = getThemeDefinition("portal-modern");

    expect(definition.id).toBe("portal-modern");
    expect(definition.name).toBe("Portal Modern");
    expect(definition.version).toBe("1.0.0");
    expect(definition.engineVersion).toBe("1");
    expect(listThemeDefinitions().some((theme) => theme.id === "portal-modern")).toBe(true);
  });

  it("discovers Portal Modern sections and templates from package metadata", () => {
    const definition = getThemeDefinition("portal-modern");

    expect(definition.sections.map((section) => section.name)).toEqual([
      "Announcement Bar",
      "Header",
      "Hero",
      "Featured Cards",
      "Content Grid",
      "Call to Action",
      "Footer",
    ]);
    expect(definition.templates.map((template) => template.file)).toEqual([
      "templates/index.tsx",
      "templates/page.tsx",
      "templates/search.tsx",
      "templates/404.tsx",
    ]);
  });

  it("contains the required theme package folders", () => {
    const paths = Object.keys(portalModernFiles);

    expect(paths).toContain("theme.config.ts");
    for (const directory of ["config/", "layout/", "templates/", "sections/", "components/", "assets/", "locales/"]) {
      expect(paths.some((path) => path.startsWith(directory))).toBe(true);
    }
  });

  it("rejects unsafe theme file paths and forbidden imports", () => {
    expect(() => validateThemeFilePath("../secret.ts")).toThrow(BadRequestException);
    expect(() => validateThemeFileContent("sections/Hero/Hero.tsx", "import fs from 'fs';")).toThrow(BadRequestException);
  });
});
