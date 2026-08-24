import { BlogCategoriesWorkspace } from "../../../../../features/websites/blog-categories-workspace";

export default function WebsiteBlogCategoriesRoute({ params }: { params: Promise<{ id: string }> }) {
  return <BlogCategoriesWorkspace params={params} />;
}
