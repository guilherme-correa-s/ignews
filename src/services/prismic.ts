import * as prismic from "@prismicio/client";
import { enableAutoPreviews } from "@prismicio/next";
import sm from "../../sm.json";

export const endpoint = sm.apiEndpoint;
export const repositoryName = prismic.getRepositoryName(endpoint);

interface config {
  accessToken?: string;
  previewData?: string | false | object | undefined;
  req?: {
    headers?: {
      cookie?: string;
    };
    query?: Record<string, unknown>;
  };
}

export function linkResolver(doc: any) {
  switch (doc.type) {
    case "homepage":
      return "/";
    case "page":
      return `/${doc.uid}`;
    default:
      return null;
  }
}

export function createClient(
  config: config = { accessToken: process.env.PRISMIC_ACCESS_TOKEN }
) {
  const client = prismic.createClient(endpoint, {
    ...config,
  });

  enableAutoPreviews({
    client,
    previewData: config.previewData,
    req: config.req,
  });

  return client;
}
