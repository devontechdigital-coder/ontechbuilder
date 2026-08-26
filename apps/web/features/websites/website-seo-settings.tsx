"use client";

import { CheckCircle2, Code2, Image as ImageIcon, Map, Search, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/display";
import { Checkbox, Input, Textarea } from "../../components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { apiRequest } from "../../lib/api";
import type { WebsiteSummary } from "./types";

const MAX_CODE_LENGTH = 20_000;

/**
 * SEO & advanced settings — favicon, raw head/body/footer code injection, and the
 * search-engine-visibility / robots.txt / sitemap.xml toggles. Lives on its own (rather than
 * folded into website-workspace.tsx's already-large settings section) since it's a genuinely
 * separate concern with its own save action.
 */
export function WebsiteSeoSettings({
  activeTenantId,
  onSaved,
  website,
}: {
  activeTenantId: string;
  onSaved: (website: WebsiteSummary) => void;
  website: WebsiteSummary;
}) {
  const [faviconUrl, setFaviconUrl] = useState(website.faviconUrl);
  const [headCode, setHeadCode] = useState(website.headCode);
  const [bodyCode, setBodyCode] = useState(website.bodyCode);
  const [footerCode, setFooterCode] = useState(website.footerCode);
  const [searchEngineVisible, setSearchEngineVisible] = useState(website.searchEngineVisible);
  const [robotsTxtEnabled, setRobotsTxtEnabled] = useState(website.robotsTxtEnabled);
  const [robotsTxtContent, setRobotsTxtContent] = useState(website.robotsTxtContent);
  const [sitemapEnabled, setSitemapEnabled] = useState(website.sitemapEnabled);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await apiRequest<WebsiteSummary>(`/tenants/${activeTenantId}/websites/${website.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          faviconUrl,
          headCode,
          bodyCode,
          footerCode,
          searchEngineVisible,
          robotsTxtEnabled,
          robotsTxtContent,
          sitemapEnabled,
        }),
      });
      onSaved(updated);
      toast.success("SEO settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "SEO settings failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Search className="size-[18px]" />
        </div>
        <div>
          <h2 className="text-[14.5px] font-semibold leading-5 text-foreground">SEO & advanced</h2>
          <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">
            Favicon, injected code, and how search engines see this website.
          </p>
        </div>
      </div>

      <form className="grid gap-5" onSubmit={save}>
        <SettingGroup icon={<ImageIcon className="size-3.5" />} title="Favicon">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-surface-secondary bg-[image:repeating-conic-gradient(#e5e5e5_0_25%,transparent_0_50%)] bg-[length:8px_8px]">
              {faviconUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={faviconUrl}
                  alt=""
                  className="size-full object-contain"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
              ) : (
                <ImageIcon className="size-4 text-muted-foreground" />
              )}
            </div>
            <Input
              className="flex-1"
              placeholder="https://.../favicon.png"
              value={faviconUrl}
              onChange={(event) => setFaviconUrl(event.target.value)}
            />
          </div>
          <p className="pl-[3.5rem] text-[11.5px] leading-4 text-muted-foreground">
            Shown in browser tabs, bookmarks, and search results for the published site.
          </p>
        </SettingGroup>

        <SettingGroup icon={<Code2 className="size-3.5" />} title="Custom code">
          <Tabs defaultValue="head">
            <TabsList>
              <TabsTrigger value="head">Head</TabsTrigger>
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="footer">Footer</TabsTrigger>
            </TabsList>
            <TabsContent value="head">
              <CodeField
                value={headCode}
                onChange={setHeadCode}
                placeholder={'<meta name="google-site-verification" content="..." />'}
                hint="Injected right before </head> on every page — analytics, verification tags, custom fonts."
              />
            </TabsContent>
            <TabsContent value="body">
              <CodeField
                value={bodyCode}
                onChange={setBodyCode}
                placeholder="<!-- e.g. a chat widget's opening snippet -->"
                hint="Injected right after the opening <body> tag on every page."
              />
            </TabsContent>
            <TabsContent value="footer">
              <CodeField
                value={footerCode}
                onChange={setFooterCode}
                placeholder="<script>/* loads after the page's own content */</script>"
                hint="Injected right before </body> — the usual spot for tracking pixels and chat widgets."
              />
            </TabsContent>
          </Tabs>
        </SettingGroup>

        <SettingGroup icon={<ShieldCheck className="size-3.5" />} title="Search engines">
          <Checkbox
            label="Allow search engines to index this website"
            checked={searchEngineVisible}
            onChange={(event) => setSearchEngineVisible(event.target.checked)}
          />
          <p className="pl-6 text-[11.5px] leading-4 text-muted-foreground">
            {searchEngineVisible
              ? "Pages are open to indexing — the usual setting for a live site."
              : "Every page tells search engines not to index it or follow its links (noindex, nofollow) — use this for a site still under construction."}
          </p>

          <div className="mt-1 grid gap-2 border-t pt-4">
            <Checkbox
              label="Use a custom robots.txt"
              checked={robotsTxtEnabled}
              onChange={(event) => setRobotsTxtEnabled(event.target.checked)}
            />
            {robotsTxtEnabled ? (
              <div className="pl-6">
                <Textarea
                  className="min-h-28 font-mono text-[12px]"
                  placeholder={"User-agent: *\nAllow: /\nSitemap: https://your-domain.com/sitemap.xml"}
                  value={robotsTxtContent}
                  onChange={(event) => setRobotsTxtContent(event.target.value)}
                />
              </div>
            ) : (
              <p className="pl-6 text-[11.5px] leading-4 text-muted-foreground">
                Served automatically at /robots.txt, matching the visibility setting above.
              </p>
            )}
          </div>
        </SettingGroup>

        <SettingGroup icon={<Map className="size-3.5" />} title="Sitemap">
          <Checkbox
            label="Generate sitemap.xml automatically"
            checked={sitemapEnabled}
            onChange={(event) => setSitemapEnabled(event.target.checked)}
          />
          <p className="pl-6 text-[11.5px] leading-4 text-muted-foreground">
            Lists every published page and blog post at /sitemap.xml for search engines to crawl.
          </p>
        </SettingGroup>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <CheckCircle2 className="size-4" />
            {saving ? "Saving…" : "Save SEO settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SettingGroup({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <div className="grid gap-3 rounded-lg border bg-surface-secondary/40 p-3.5">
      <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function CodeField({
  hint,
  onChange,
  placeholder,
  value,
}: {
  hint: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Textarea
        className="min-h-32 font-mono text-[12px]"
        maxLength={MAX_CODE_LENGTH}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-[11.5px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  );
}
