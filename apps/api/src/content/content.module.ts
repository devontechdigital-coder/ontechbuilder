import { Module } from "@nestjs/common";
import { BuilderModule } from "./builder/builder.module.js";
import { CmsModule } from "./cms/cms.module.js";
import { FormsModule } from "./forms/forms.module.js";
import { MediaModule } from "./media/media.module.js";
import { PagesModule } from "./pages/pages.module.js";

@Module({
  imports: [MediaModule, PagesModule, FormsModule, CmsModule, BuilderModule],
})
export class ContentModule {}
