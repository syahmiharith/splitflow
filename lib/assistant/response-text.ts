/** Responses API commentary is progress, not the completed conversational answer.
 * Keep original output items intact when replaying tools; select only final text for display.
 * https://developers.openai.com/api/docs/guides/reasoning#phase-parameter
 */
type OutputItem = { type: string; phase?: string | null; role?: string; content?: { type: string; text?: string; refusal?: string }[] };
export function finalResponseText(output: readonly OutputItem[]): string {
  const messages=output.filter(item=>item.type==="message" && (!item.role || item.role==="assistant"));
  const final=messages.filter(item=>item.phase==="final_answer");
  const selected=final.length?final:messages.filter(item=>item.phase==null);
  return selected.map(item=>(item.content??[]).map(part=>part.type==="output_text"?part.text??"":part.type==="refusal"?part.refusal??"":"").filter(Boolean).join("\n\n").trim()).filter(Boolean).join("\n\n");
}
export function hasIntermediateCommentary(output: readonly OutputItem[]): boolean {
  return output.some(item=>item.type==="message" && item.phase==="commentary");
}
