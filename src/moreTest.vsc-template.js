(function Template() {
    const toPascalCase = (str) => str.replace(/(?:^\w|[A-Z]|\b\w)/g, (fl) => fl.toUpperCase()).replace(/\W+/g, '');
    const toCamelCase = (str) => toPascalCase(str).replace(/^./, (firstLetter) => firstLetter.toLowerCase());
    const toKebabCase = (str) => toCamelCase(str).replace(/([A-Z])/g, (word) => '-' + word.toLowerCase());

    return {
        userInputs: [
            {
                title: 'What is the Component Name',
                argumentName: 'name', // will become input in template
                defaultValue: 'SampleComponent',
            },
        ],
        template: [
            {
                type: 'folder',
                name: (inputs) => `${toKebabCase(inputs.name)}`,
                children: [
                    {
                        type: 'file',
                        name: (inputs) => `index.ts`,
                        content: (inputs) => `import ${toPascalCase(inputs.name)} from './${toKebabCase(inputs.name)}';

            export default ${toPascalCase(inputs.name)};`,
                    },
                    {
                        type: 'file',
                        name: (inputs) => `${toKebabCase(inputs.name)}.tsx`,
                        content: (inputs) => `import React from 'react';

            interface ${toPascalCase(inputs.name)}Props {
            
            }
            
            const ${toPascalCase(inputs.name)}: React.FC<${toPascalCase(inputs.name)}Props> = ({ }) => {
              return (
                <div>${toPascalCase(inputs.name)}</div>
              )
            }
            
            export default ${toPascalCase(inputs.name)};`,
                    },
                      {
                      type: 'file',
                      name: (inputs) => `${toKebabCase(inputs.name)}.webPreview.html`,
                      content: (inputs) => `<!DOCTYPE html>
                          <html lang="en">
                            <head>
                              <meta charset="UTF-8">
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                              <!-- <link rel="stylesheet" href="src/style.css"> -->
                            </head>
                            <body style="background-color: gray; font-family: Arial, sans-serif">
                              <h1>WEB PREVIEW!</h1>
                            </body>
                        </html>`
                    },
                ]
            }]
    }
})