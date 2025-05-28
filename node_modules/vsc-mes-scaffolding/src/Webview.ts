import { Uri, window, ExtensionContext, ViewColumn} from 'vscode';
import * as vsc from 'vsc-base';
import * as path from 'path';


interface ITemplateMap {
   area: string[],
   displayName: string;
   name: string;
   name_lower: string;
   path: string
   type: 'ts' | 'js'
}

export async function getTemplateFiles() {

   const templateFiles = await vsc.findFilePaths('**/*.vsc-template.{js,ts}')
   const templates: ITemplateMap[] = []
   for (let filePath of templateFiles) {
      const match = filePath.match(/([\w\-]+)\.vsc\-template\.(ts|js)$/)
      if (match) {
         const content = await vsc.getFileContent(filePath)
         const nameLabelMatch = content.match(/(?:^|\n)\s*\/\/vsc\-template\-name\:([^\n]*)/)
         const name = nameLabelMatch ? nameLabelMatch[1] : match[1]
         const type = match[2] === 'ts' ? 'ts' : 'js'
         templates.push({
            area: ['Other'],
            type,
            name,
            displayName: name,
            name_lower: name.toLocaleLowerCase(),
            path: filePath
         })
      }
   }


   if (templates.length === 0) {
      vsc.showErrorMessage(`No Templates Found`)
      return [];
   }
   return templates
}

export async function getTemplateHTML(templateName: string): Promise<string | null> {
   if (!templateName) {
      vsc.showErrorMessage("No template name provided");
      return null;
   }
   const templates = cachedTemplates || []
   const selectedTemplate = templates.find(t => t.displayName === templateName);
   if (!selectedTemplate) {
      vsc.showErrorMessage("Template not found");
      return null;
   }

   const content = await vsc.getFileContent(selectedTemplate.path);
   const webPreviewMatch = content.match(/content:\s*\(\s*inputs\s*\)\s*=>\s*`(<\!DOCTYPE html[\s\S]*?<\/html>)`/);

   if (!webPreviewMatch) {
      // vsc.showErrorMessage("No HTML found in template file");
      return null;
   }

   return webPreviewMatch[1].trim();
}



let cachedTemplates: ITemplateMap[] | null = null

async function getCachedTemplates() {
   if (!cachedTemplates) {
      cachedTemplates = await getTemplateFiles()
   } return cachedTemplates
}


const getJsTemplate = async (path: string) => {
   const templateFile = await vsc.getFileContent(path)
   const templateCompiledFunction = eval(templateFile)
   const template: vsc.vscTemplate = templateCompiledFunction()
   return template;
}
const getTsTemplate = async (templatePath: string, path: string) => {
   try {
      let scriptFileExport
      scriptFileExport = await vsc.tsLoadModule(templatePath)
      const verifiedModule = vsc.verifyModuleMethods(scriptFileExport, ['Template'])
      if (!verifiedModule) {
         return undefined
      }
      const template = verifiedModule.Template(path, templatePath)
      return template
   } catch (e) {
      vsc.showErrorMessage(e as string);
   }
   return undefined
}

async function loadTemplate(selectedTemplate: ITemplateMap, path: string): Promise<vsc.vscTemplate | null> {
   if (selectedTemplate.type === "js") {
      return await getJsTemplate(selectedTemplate.path);
   } else if (selectedTemplate.type === "ts") {
      const template = await getTsTemplate(selectedTemplate.path, path);
      return template ? (await vsc.awaitResult(template)) as vsc.vscTemplate : null;
   }
   return null;
}


export async function createTemplate(uri: Uri, templateName: string, userInputs: { [key: string]: string }) {
   const path = vsc.pathAsUnix(uri.fsPath);
   let dir = vsc.getDir(path);

   const templates = cachedTemplates || []
   const selectedTemplate = templates.find(t => t.displayName === templateName);


   if (!selectedTemplate) {
      console.error("Template not found");
      return;
   }

   const template = await loadTemplate(selectedTemplate, path);
   if (!template) {
      // vscode.window.showErrorMessage(`Failed to load ${selectedTemplate.type} template.`);
      // return;
      console.error(`Failed to load ${selectedTemplate.type} template.`);
      return;
   }

   await template.template.forEach(async item => {
      await vsc.scaffoldTemplate(dir, item, userInputs);
   });

   window.showInformationMessage(`Component ${userInputs.name} created with template ${selectedTemplate.displayName} `);
}

export async function initWebview(context: ExtensionContext, uri?: Uri) {
   const panel = window.createWebviewPanel(
      'mesScaffolding',
      'MES Scaffolding',
      ViewColumn.One,
      { enableScripts: true }
   );
   const cachedTemplates = getCachedTemplates()
   if (!uri) {
      vsc.showErrorMessage(
         'vsc MES Scaffolding most be run by right-clicking a file or folder!'
      )
      return
   }


   panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
         case "startComponent":
            panel.webview.postMessage({
               command: "chooseTemplate",
               templates: await getCachedTemplates(),
            });
            break;

         case "templateSelected":
            panel.webview.postMessage({
               command: "askForName",
               templateName: message.templateName,
               htmlContent: await getTemplateHTML(message.templateName),
            });
            break;

         case "createTemplate":
            if (!message.templateName) {
               window.showErrorMessage("Invalid Template Name");
               return;
            }
            const templates = await cachedTemplates
            const selectedTemplate = templates.find(t => t.displayName === message.templateName);
            if (!selectedTemplate) {
               panel.webview.postMessage({ command: "error", message: "Template not found." });
               return;
            }
            await createTemplate(uri, message.templateName, message.userInputs);
            break;
      }
   });


   // const cssPath = Uri.file(path.join(context.extensionPath, "src", "styles.css"));
   // const cssUri = panel.webview.asWebviewUri(cssPath);
   const cssUri = panel.webview.asWebviewUri(
      Uri.joinPath(context.extensionUri, "/src", "styles.css")
   );

   console.log(cssUri)



   panel.webview.html = `
      
   <html>
    <head>
        <link rel="stylesheet" href="${cssUri}">
    </head>
    <body>
        <div class="container">
            <h2 class="header">MES Scaffolding</h2>
            <div class="sidebar">
                <div id="templateCardsContainer"></div>
                <button id="createComponent" >Create Component</button>
            </div>
            <div class="content" id="templateContent"></div>
        </div>
        <script>
            
const vscode = acquireVsCodeApi();
let selectedTemplate = null;

checkValidation()

window.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage({ command: "startComponent" });
});

window.addEventListener("message", (event) => {
    const contentArea = document.getElementById("templateContent");
    const templateCardsContainer = document.getElementById("templateCardsContainer");

    switch (event.data.command) {
        case "chooseTemplate":
            templateCardsContainer.innerHTML = "";

            if (!event.data.templates || event.data.templates.length === 0) {
                console.error("No templates found.");
                return;
            }

            event.data.templates.forEach(t => {
                const card = document.createElement("div");
                card.classList.add("template-card");
                card.textContent = t.displayName;

                card.addEventListener("click", () => {
                    selectedTemplate = t.displayName;
                    vscode.postMessage({ command: "templateSelected", templateName: t.displayName });

                    const selectedCard = document.querySelector(".selected");
                    if (selectedCard) selectedCard.classList.remove("selected");
                    card.classList.add("selected");
                     
                });

                templateCardsContainer.appendChild(card);
            });
            break;

        case "askForName":
            contentArea.innerHTML = "";

            const label = document.createElement("div");
            label.textContent = "Enter a component name:";
            const input = document.createElement("input");
            input.type = "text";
            input.id = "name";
            input.addEventListener("input", checkValidation);

            contentArea.appendChild(label);
            contentArea.appendChild(input);

            const iframe = document.createElement("iframe");
            if (!event.data.htmlContent || event.data.htmlContent.trim() === "null") {
               iframe.classList.add("null-content");
               iframe.srcdoc = "<div class='null-message' style='font-family: Arial, sans-serif; font-size: 4vh;'>No content available</div>";
            } else {
               iframe.classList.add("template-frame");
               iframe.setAttribute("srcdoc", event.data.htmlContent);
            }
            contentArea.appendChild(iframe);


    }
});


function checkValidation() {
    const createBtn = document.getElementById("createComponent");
    const nameInput = document.getElementById("name");

    createBtn.disabled = !selectedTemplate && !nameInput?.value.trim();
}

document.getElementById("createComponent").addEventListener("click", () => {
    if (!selectedTemplate || !document.getElementById("name")?.value.trim()) return;

    vscode.postMessage({
        command: "createTemplate",
        templateName: selectedTemplate,
        userInputs: { name: document.getElementById("name").value.trim() }
    });
});

vscode.postMessage({ command: "startComponent" });
vscode.postMessage({ command: "askForName" });
checkValidation();


        </script>
    </body>
</html>
   `;
}