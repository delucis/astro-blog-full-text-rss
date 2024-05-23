import rss, { type RSSFeedItem } from "@astrojs/rss";
import type { APIContext } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getCollection } from "astro:content";
import { transform, walk } from "ultrahtml";
import sanitize from "ultrahtml/transformers/sanitize";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import Renderer from "./_rss/ContentRenderer.astro";

export async function GET(context: APIContext) {
  // Get the URL to prepend to relative site links. Based on `site` in `astro.config.mjs`.
  let baseUrl = context.site?.href || "https://example.com";
  if (baseUrl.at(-1) === "/") baseUrl = baseUrl.slice(0, -1);

  // Create a new Astro container that we can render components with.
  // See https://docs.astro.build/en/reference/container-reference/
  const container = await AstroContainer.create({
    // This tells the container how to render MDX. In the future maybe this will be optional/handled for you?
    renderers: [
      { name: "@astrojs/mdx", serverEntrypoint: "astro/jsx/server.js" },
    ],
  });

  // Load the content collection entries to add to our RSS feed.
  const posts = (await getCollection("blog")).sort((a, b) =>
    // Sort by publication date descending.
    a.data.pubDate > b.data.pubDate ? -1 : 1
  );

  // Loop over blog posts to create feed items for each, including full content.
  const feedItems: RSSFeedItem[] = [];
  for (const { data, slug, collection } of posts) {
    // Use the Astro container to render the content to a string.
    const rawContent = await container.renderToString(Renderer, {
      params: { collection, slug },
    });
    // Process and sanitize the raw content:
    // - Makes link `href` and image `src` attributes absolute instead of relative
    // - Strips any `<script>` and `<style>` tags
    // Thanks @Princesseuh — https://github.com/Princesseuh/erika.florist/blob/1827288c14681490fa301400bfd815acb53463e9/src/middleware.ts
    const content = await transform(rawContent, [
      async (node) => {
        await walk(node, (node) => {
          if (node.name === "a" && node.attributes.href?.startsWith("/")) {
            node.attributes.href = baseUrl + node.attributes.href;
          }
          if (node.name === "img" && node.attributes.src?.startsWith("/")) {
            node.attributes.src = baseUrl + node.attributes.src;
          }
        });
        return node;
      },
      sanitize({ dropElements: ["script", "style"] }),
    ]);
    feedItems.push({ ...data, link: `/blog/${slug}/`, content });
  }

  // Return our RSS feed XML response.
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: baseUrl,
    items: feedItems,
  });
}
