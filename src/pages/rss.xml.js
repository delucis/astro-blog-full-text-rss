// @ts-check

import rss from "@astrojs/rss";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getCollection } from "astro:content";
import { transform, walk } from "ultrahtml";
import sanitize from "ultrahtml/transformers/sanitize";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import Renderer from "./_rss/ContentRenderer.astro";

let baseUrl = import.meta.env.SITE;
if (baseUrl.at(-1) === "/") baseUrl = baseUrl.slice(0, -1);

const container = await AstroContainer.create({
  renderers: [
    { name: "@astrojs/mdx", serverEntrypoint: "astro/jsx/server.js" },
  ],
});

export async function GET(context) {
  const posts = await getCollection("blog");
  return rss({
    // stylesheet: '/styles.xsl',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: await Promise.all(
      posts.map(async ({ data, slug }) => {
        let content = await container.renderToString(Renderer, {
          params: { slug },
        });
        // Thanks @Princesseuh — https://github.com/Princesseuh/erika.florist/blob/1827288c14681490fa301400bfd815acb53463e9/src/middleware.ts
        content = await transform(content, [
          async (node) => {
            await walk(node, (node) => {
              // Make sure links are absolute, some readers are not smart enough to figure it out
              if (node.name === "a" && node.attributes.href?.startsWith("/")) {
                node.attributes.href = baseUrl + node.attributes.href;
              }
              // Same thing but for image src attributes
              if (node.name === "img" && node.attributes.src?.startsWith("/")) {
                node.attributes.src = baseUrl + node.attributes.src;
              }
            });
            return node;
          },
          sanitize({ dropElements: ["script", "style"] }),
        ]);
        return { ...data, link: `/blog/${slug}/`, content };
      })
    ),
  });
}
