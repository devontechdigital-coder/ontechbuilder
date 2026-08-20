import { publicPageMetadata, renderPublicPage } from "./public-renderer";

export async function generateMetadata() {
  return publicPageMetadata("/");
}

export default async function PublicHomePage() {
  return renderPublicPage("/");
}
