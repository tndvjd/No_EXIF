const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  
  // Wait for the ModeRail to render
  await page.waitForSelector('.rail-button.is-active');
  
  const styles = await page.evaluate(() => {
    const button = document.querySelector('.rail-button.is-active');
    if (!button) return 'No active button found';
    
    const computed = window.getComputedStyle(button);
    return {
      borderColor: computed.borderColor,
      backgroundColor: computed.backgroundColor,
      boxShadow: computed.boxShadow,
      border: computed.border,
      outline: computed.outline,
      outlineColor: computed.outlineColor,
    };
  });
  
  console.log('Computed Styles of .rail-button.is-active:', JSON.stringify(styles, null, 2));
  
  await browser.close();
})();
