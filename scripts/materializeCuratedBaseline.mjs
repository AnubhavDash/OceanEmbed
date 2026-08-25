import { materializeCuratedBaseline } from "../server/materializeBaseline.ts";

const result = await materializeCuratedBaseline();
console.log(JSON.stringify(result, null, 2));
