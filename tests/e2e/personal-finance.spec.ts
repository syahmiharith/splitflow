import { test, expect, type Page } from "@playwright/test";

async function select(page:Page,label:string,option:string){
  await page.locator("label").filter({hasText:label}).filter({has:page.getByRole("combobox")}).first().getByRole("combobox").click();
  await page.getByRole("option",{name:option,exact:true}).click();
}
async function manual(page:Page,item:string){
  await page.getByRole("button",{name:"Enter manually",exact:true}).click();
  await page.getByRole("button",{name:item,exact:true}).click();
}
async function account(page:Page,name:string,currency:string,amount:string){
  await manual(page,"Personal finances");
  await page.getByLabel("Account name",{exact:true}).fill(name);
  if(currency!=="KRW")await select(page,"Currency",currency);
  await page.getByLabel("Starting balance",{exact:true}).fill(amount);
  await page.getByRole("button",{name:"Review changes",exact:true}).click();
  const review=page.getByRole("region",{name:"Review proposed changes"});
  await expect(review).toContainText(name);
  await page.getByRole("button",{name:"Confirm changes",exact:true}).click();
  await expect(page.getByRole("region",{name:"Previous review"}).last()).toContainText("Saved");
}
async function overview(page:Page){
  const open=page.getByRole("button",{name:"Open navigation",exact:true});
  if(await open.isVisible())await open.click();
  await page.getByRole("button",{name:"Your finances",exact:true}).filter({visible:true}).click();
  return page.getByRole("region",{name:"Personal finances"});
}

test("personal finance fallback reviews and persists separate currencies with overview handoff",async({page})=>{
  await page.goto("/");
  await account(page,"Won account","KRW","100000");
  await account(page,"Dollar account","USD","200.50");
  await page.reload();
  const view=await overview(page);
  await expect(view.getByRole("button").filter({hasText:"Won account"})).toContainText("₩100,000");
  await expect(view.getByRole("button").filter({hasText:"Dollar account"})).toContainText("$200.50");
  await view.getByRole("button",{name:"Plan & goals",exact:true}).click();
  await expect(view).toContainText("KRW · ₩100,000 available to assign");
  await expect(view).toContainText("USD · $200.50 available to assign");
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await view.getByRole("button",{name:"Ask SplitFlow",exact:true}).click();
  await expect(page.getByLabel("Message SplitFlow")).toHaveValue("Help me manage my personal finances.");
});

test("CSV mapping creates an inline review, imports once and reopens recorded transactions",async({page})=>{
  await page.goto("/");
  await account(page,"CSV account","USD","100.00");
  await manual(page,"Import transactions");
  const csv="Date,Payee,Amount\n2026-11-01,Coffee,-4.50\n2026-11-02,Salary,200.00\n";
  await page.getByLabel("CSV file").setInputFiles({name:"transactions.csv",mimeType:"text/csv",buffer:Buffer.from(csv)});
  await select(page,"Account","CSV account · USD");
  await select(page,"Date column","Date");
  await select(page,"Payee column","Payee");
  await select(page,"Signed amount","Amount");
  await page.getByRole("button",{name:"Review import",exact:true}).click();
  const review=page.getByRole("region",{name:"Review proposed changes"});
  await expect(review).toContainText("Coffee");await expect(review).toContainText("$4.50");
  await page.getByRole("button",{name:"Confirm changes",exact:true}).click();
  await expect(page.getByRole("region",{name:"Previous review"}).last()).toContainText("Saved");
  const view=await overview(page);
  await view.getByRole("button").filter({hasText:"CSV account"}).click();
  await expect(view).toContainText("$295.50");await expect(view.getByRole("button").filter({hasText:"Coffee"})).toContainText("-$4.50");
  await view.getByRole("button",{name:"Ask SplitFlow",exact:true}).click();
  await expect(page.getByLabel("Message SplitFlow")).toBeFocused();
  await manual(page,"Import transactions");
  await page.getByLabel("CSV file").setInputFiles({name:"transactions.csv",mimeType:"text/csv",buffer:Buffer.from(csv)});
  await select(page,"Account","CSV account · USD");
  await page.getByRole("button",{name:"Review import",exact:true}).click();
  await expect(page.getByRole("region",{name:"Import transactions"}).getByRole("alert")).toContainText("No new transactions");
});
