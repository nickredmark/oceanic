import * as youtubedl from "youtube-dl";
import { parseString } from "xml2js";
import { readFileSync } from "fs";

export default async (req, res) => {
  try {
    const {
      query: { id }
    } = req;
    const url = `https://youtu.be/${id}`;
    const files = await new Promise((res, rej) =>
      (youtubedl as any).getSubs(
        url,
        {
          auto: true,
          all: false,
          format: "ttml",
          lang: "en",
          cwd: `/tmp`
        },
        (err, files) => (err ? rej(err) : res(files))
      )
    );
    const subsXml = readFileSync(`/tmp/${files[0]}`, "utf8");
    const subs = await new Promise<any>((res, rej) =>
      parseString(subsXml, (err, subs) => (err ? rej(err) : res(subs)))
    );

    const final = subs.tt.body[0].div[0].p.map(p => ({
      text: p._,
      begin: p.$.begin,
      end: p.$.end
    }));
    res.setHeader("Cache-Control", "max-age=31536000");
    return res.send(final);
  } catch (e) {
    console.error(e);
    throw e;
  }
};
