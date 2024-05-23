// @ts-check

import rss from '@astrojs/rss';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import Renderer from './_rss/ContentRenderer.astro';
import sanitize from 'sanitize-html';
import { ELEMENT_NODE, TEXT_NODE, transform, walk } from "ultrahtml";

let baseUrl = import.meta.env.SITE;
if (baseUrl.at(-1) === '/') baseUrl = baseUrl.slice(0, -1);

const container = await AstroContainer.create({
  renderers: [
    { name: '@astrojs/mdx', serverEntrypoint: 'astro/jsx/server.js' },
  ],
});

export async function GET(context) {
  const posts = await getCollection('blog');
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
        content = await transform(content, [async (node) => {
          await walk(node, (node) => {
            // Make sure links are absolute, some readers are not smart enough to figure it out
            if (node.name === "a" && node.attributes.href?.startsWith("/")) {
              node.attributes.href = baseUrl + node.attributes.href;
            }
            if (node.name === 'img' && node.attributes.src?.startsWith('/')) {
              node.attributes.src = baseUrl + node.attributes.src;
            }
          })
          return node;
        }]);
        // Sanitize HTML but allow for <img> tags.
        content = sanitize(content, {
          allowedTags: sanitize.defaults.allowedTags.concat(['img']),
        });
        return { ...data, link: `/blog/${slug}/`, content };
      })
    ),
  });
}
