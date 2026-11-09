import { render,screen,cleanup } from "@testing-library/react";
import { afterEach,it,expect } from "vitest";
import { AssistantMessageText } from "@/components/activity/assistant-message-text";
afterEach(cleanup);
it("renders only an account-export overview handoff while preserving surrounding text",()=>{
 render(<AssistantMessageText text="Review your account: [Open wallet](/?finance=wallet-1). Then choose Export CSV."/>);
 expect(screen.getByRole("link",{name:"Open wallet"})).toHaveAttribute("href","/?finance=wallet-1");
 expect(screen.getByText(/Then choose Export CSV/)).toBeInTheDocument();
});
it("does not activate external URLs, scripts or arbitrary markdown",()=>{
 render(<AssistantMessageText text={'[Bad](javascript:alert(1)) https://evil.test/?finance=wallet <img src=x> [Other](/api/private)'}/>);
 expect(screen.queryByRole("link")).not.toBeInTheDocument();
 expect(document.querySelector("img")).toBeNull();
});
it("allows plain safe overview paths and rejects malformed escapes",()=>{
 render(<AssistantMessageText text="Open /?finance=wallet%201 or /?finance=%ZZ"/>);
 expect(screen.getAllByRole("link")).toHaveLength(1);expect(screen.getByRole("link")).toHaveAttribute("href","/?finance=wallet%201");
});
