import { renderPublicPage } from "./public-renderer";

export default async function PublicHomePage() {
  return renderPublicPage("/");
}
