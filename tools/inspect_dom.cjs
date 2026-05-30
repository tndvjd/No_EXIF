const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  
  await page.waitForSelector('.rail-button.is-active');
  
  // Find all elements under rail-modes-wrapper and their borders
  const elements = await page.evaluate(() => {
    const wrapper = document.querySelector('.rail-modes-wrapper');
    if (!wrapper) return 'No wrapper found';
    
    const results = [];
    const all = wrapper.querySelectorAll('*');
    
    // Add the wrapper itself
    all.forEach(el => {
      const computed = window.getComputedStyle(el);
      const border = computed.border;
      const borderColor = computed.borderColor;
      const bg = computed.backgroundColor;
      const outline = computed.outline;
      const shadow = computed.boxShadow;
      
      // If border, outline, shadow or background has something non-transparent/none, record it
      if (
        (border && !border.includes('transparent') && !border.includes('0px none')) ||
        (outline && !outline.includes('none') && !outline.includes('0px')) ||
        (shadow && shadow !== 'none') ||
        (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent')
      ) {
        results.push({
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          styleAttr: el.getAttribute('style'),
          border,
          borderColor,
          bg,
          outline,
          shadow
        });
      }
    });
    return results;
  });
  
  console.log('Elements with borders/backgrounds:', JSON.stringify(elements, null, 2));
  
  await browser.close();
})();
