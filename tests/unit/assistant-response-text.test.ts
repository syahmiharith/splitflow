import { describe,it,expect } from "vitest";
import { finalResponseText,hasIntermediateCommentary } from "@/lib/assistant/response-text";
describe("Responses final text selection",()=>{
 it("does not concatenate an intermediate clarification preamble with the final question",()=>{
  const output=[{type:"message",phase:"commentary",content:[{type:"output_text",text:"I need one detail before I can prepare the review: what payee name should I use for the grocery expense?"}]},{type:"message",phase:"final_answer",content:[{type:"output_text",text:"What payee name should I use for the grocery expense?"}]}];
  expect(finalResponseText(output)).toBe("What payee name should I use for the grocery expense?");
  expect(hasIntermediateCommentary(output)).toBe(true);
 });
 it("supports legacy unphased messages and preserves paragraph boundaries",()=>{
  expect(finalResponseText([{type:"message",content:[{type:"output_text",text:"First paragraph."}]},{type:"message",phase:null,content:[{type:"output_text",text:"Second paragraph."}]}])).toBe("First paragraph.\n\nSecond paragraph.");
 });
 it("does not render commentary-only, reasoning or unknown channels as a completed answer",()=>{
  const output=[{type:"message",phase:"commentary",content:[{type:"output_text",text:"Checking."}]},{type:"reasoning",content:[{type:"output_text",text:"Hidden."}]},{type:"message",phase:"analysis",content:[{type:"output_text",text:"Not final."}]}];
  expect(finalResponseText(output)).toBe("");expect(hasIntermediateCommentary(output)).toBe(true);
 });
 it("selects explicit final output over unphased intermediates and preserves refusal text",()=>{
  expect(finalResponseText([{type:"message",content:[{type:"output_text",text:"Old text"}]},{type:"message",phase:"final_answer",content:[{type:"refusal",refusal:"I cannot perform that action."}]}])).toBe("I cannot perform that action.");
 });
 it("does not mutate replayed phase metadata",()=>{
  const output=[{type:"message",phase:"commentary",content:[{type:"output_text",text:"Checking."}]},{type:"message",phase:"final_answer",content:[{type:"output_text",text:"Done."}]}];const original=structuredClone(output);finalResponseText(output);expect(output).toEqual(original);
 });
});

it("continues commentary-only provider responses and returns only the final clarification",async()=>{
 const {runAssistant}=await import("@/lib/assistant/provider");const {emptyThread}=await import("@/lib/assistant/model");
 let calls=0;
 const result=await runAssistant(emptyThread(crypto.randomUUID(),null),[],"alex@example.test",async input=>{
  if(calls++===0)return {output:[{type:"message",phase:"commentary",content:[{type:"output_text",text:"I need a payee."}]}]};
  expect(input).toContainEqual({type:"message",phase:"commentary",content:[{type:"output_text",text:"I need a payee."}]});
  return {output:[{type:"message",phase:"final_answer",content:[{type:"output_text",text:"What payee should I use?"}]}]};
 });expect(result.text).toBe("What payee should I use?");expect(calls).toBe(2);
});
