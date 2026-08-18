import type { ComponentType } from "react";
import Introduction from "./content/introduction";
import QuickStart from "./content/quick-start";
import PackageStructure from "./content/package-structure";
import ThemeConfigDoc from "./content/theme-config";
import SettingsSchemaDoc from "./content/settings-schema";
import SectionSchemasDoc from "./content/section-schemas";
import BlocksAndNestingDoc from "./content/blocks-and-nesting";
import SectionComponentsDoc from "./content/section-components";
import BlockHelpersDoc from "./content/block-helpers";
import TemplatesDoc from "./content/templates";
import SectionRegistryDoc from "./content/section-registry";
import ThemeLayoutDoc from "./content/theme-layout";
import HowRenderingWorksDoc from "./content/how-rendering-works";
import SandboxConstraintsDoc from "./content/sandbox-constraints";
import EditorIntegrationDoc from "./content/editor-integration";
import ChecklistDoc from "./content/checklist";

export const DOC_CONTENT: Record<string, ComponentType> = {
  introduction: Introduction,
  "quick-start": QuickStart,
  "package-structure": PackageStructure,
  "theme-config": ThemeConfigDoc,
  "settings-schema": SettingsSchemaDoc,
  "section-schemas": SectionSchemasDoc,
  "blocks-and-nesting": BlocksAndNestingDoc,
  "section-components": SectionComponentsDoc,
  "block-helpers": BlockHelpersDoc,
  templates: TemplatesDoc,
  "section-registry": SectionRegistryDoc,
  "theme-layout": ThemeLayoutDoc,
  "how-rendering-works": HowRenderingWorksDoc,
  "sandbox-constraints": SandboxConstraintsDoc,
  "editor-integration": EditorIntegrationDoc,
  checklist: ChecklistDoc,
};
