document.getElementById('process-prompts').addEventListener('click', () => {
    const jsonInput = document.getElementById('json-input').value;
    let prompts;

    // Split input by lines
    const lines = jsonInput.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Convert lines to an array of objects with 'prompt' and 'number' properties
    prompts = lines.map((line, index) => ({ prompt: line, number: index + 1 }));

    if (prompts.length === 0) {
        document.getElementById('status').textContent = "Error: No prompts found in the input.";
        return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (prompts) => {
                function clearAndEnterText(text) {
                    const textBox = document.getElementById('prompt-input');
                    textBox.value = '';
                    const event = new Event('input', { bubbles: true, cancelable: true });
                    textBox.value = text;
                    textBox.dispatchEvent(event);
                }

                function pressButton() {
                    const button = document.evaluate(
                        '/html/body/main/div[1]/div[2]/form/div/div[4]/div/div/button',
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;
                    button.click();
                }

                function forceDownload(url, fileName) {
                    const xhr = new XMLHttpRequest();
                    xhr.open("GET", url, true);
                    xhr.responseType = "blob";
                    xhr.onload = function () {
                        const urlCreator = window.URL || window.webkitURL;
                        const imageUrl = urlCreator.createObjectURL(this.response);
                        const tag = document.createElement('a');
                        tag.href = imageUrl;
                        tag.download = fileName;
                        document.body.appendChild(tag);
                        tag.click();
                        document.body.removeChild(tag);
                        console.log(`Downloaded image: ${fileName}`);
                    };
                    xhr.send();
                }

                function getImageLinks() {
                    const imageContainerXPath = "/html/body/main/div[1]/div[2]/div/div/div[3]/div/div[2]";
                    const imageContainer = document.evaluate(imageContainerXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (imageContainer) {
                        const images = imageContainer.querySelectorAll('img');
                        return Array.from(images).map(img => img.src);
                    }
                    return [];
                }

                function waitForImages(callback) {
                    const imageContainerXPath = "/html/body/main/div[1]/div[2]/div/div/div[3]/div/div[2]";
                    const imageContainer = document.evaluate(imageContainerXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (imageContainer.querySelectorAll('img').length > 0) {
                        callback();
                    } else {
                        const observer = new MutationObserver((mutations, me) => {
                            if (imageContainer.querySelectorAll('img').length > 0) {
                                me.disconnect();
                                callback();
                            }
                        });
                        observer.observe(imageContainer, {
                            childList: true,
                            subtree: true
                        });
                    }
                }

                function performTasksForPrompt(promptData, callback) {
                    clearAndEnterText(promptData.prompt);
                    pressButton();

                    setTimeout(() => {
                        waitForImages(() => {
                            const imageLinks = getImageLinks();
                            imageLinks.forEach((link, index) => {
                                // Skip links that contain "_w=512"
                                if (link.includes('_w=512')) {
                                    console.log(`Skipping image with "_w=512": ${link}`);
                                    return;
                                }

                                // Extract filename from the image URL
                                const segments = link.split('/');
                                const filenameFromUrl = segments[segments.length - 1];
                                const fileName = filenameFromUrl;

                                forceDownload(link, fileName);
                            });
                            callback();
                        });
                    }, 10000); // Wait for 10 seconds after pressing button
                }

                function performTasksForAllPrompts(prompts) {
                    let index = 0;
                    function processNextPrompt() {
                        if (index < prompts.length) {
                            performTasksForPrompt(prompts[index], () => {
                                index++;
                                processNextPrompt();
                            });
                        } else {
                            console.log('All prompts processed.');
                        }
                    }
                    processNextPrompt();
                }

                performTasksForAllPrompts(prompts);
            },
            args: [prompts]
        });
    });

    document.getElementById('status').textContent = "Processing prompts...";
});
