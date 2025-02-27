import { generateUUID } from "@/lib/utils";
import { DataStreamWriter, tool, smoothStream, streamText } from "ai";
import { z } from "zod";
import { Session } from "next-auth";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { Attachment } from "ai";
import { myProvider } from "@/lib/ai/models";
import { saveDocument } from "@/lib/db/queries";

interface AnalyzeImageProps {
  session: Session;
  dataStream: DataStreamWriter;
  attachments?: Attachment[];
}

export const analyzeImage = ({
  session,
  dataStream,
  attachments = [],
}: AnalyzeImageProps) =>
  tool({
    description:
      "Analyze an uploaded clothing image and create a detailed tech pack document with specifications, measurements, and material information. This tool will use the most recently uploaded image.",
    parameters: z.object({
      title: z.string().optional().describe("Optional title for the document"),
    }),
    execute: async ({ title = "Clothing Tech Pack Analysis" }) => {
      console.log("Analyze Image Tool - Attachments received:", attachments);

      // Check if there are any image attachments
      const imageAttachment = attachments.find((attachment: Attachment) =>
        attachment.contentType?.startsWith("image/")
      );

      console.log(
        "Analyze Image Tool - Image attachment found:",
        imageAttachment
      );

      if (!imageAttachment) {
        return {
          error:
            "No image attachment found. Please upload an image first and then run this tool in the same message.",
        };
      }

      const id = generateUUID();

      // Set the document kind to 'text' since we'll be creating a text document
      const kind = "text";

      // Create the image markdown at the top of the document
      const imageMarkdown = `# ${title}\n\n![${
        imageAttachment.name || "Uploaded Image"
      }](${imageAttachment.url})\n\n`;

      // Initialize our draft content with the image
      let draftContent = imageMarkdown;

      dataStream.writeData({
        type: "kind",
        content: kind,
      });

      dataStream.writeData({
        type: "id",
        content: id,
      });

      dataStream.writeData({
        type: "title",
        content: title,
      });

      dataStream.writeData({
        type: "clear",
        content: "",
      });

      // Add the image to the document at the top
      dataStream.writeData({
        type: "text-delta",
        content: imageMarkdown,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      // Create a custom document handler that preserves our image
      const customTextHandler = {
        ...documentHandler,
        onCreateDocument: async (args: any) => {
          const { fullStream } = streamText({
            model: myProvider.languageModel("chat-model-large"),
            system:
              "Analyze this clothing item and create a structured tech pack with the following format:" +
              "## Brand\n" +
              "{{Brand Name}}\n\n" +
              "## Designer\n" +
              "{{Designer Name}}\n\n" +
              "## Description\n" +
              "{{Brief description of the garment type, e.g., WOMENSWEAR, MENSWEAR}}\n\n" +
              "## Season\n" +
              "{{Season information, e.g., SS24, FW23}}\n\n" +
              "## Style Name\n" +
              "{{Style name of the garment}}\n\n" +
              "## Style Number\n" +
              "{{Style number/code}}\n\n" +
              "## Main Fabric\n" +
              "{{Main fabric description}}\n\n" +
              "## Garment Color\n" +
              "{{Overall color of the garment}}\n\n" +
              "## Size Range\n" +
              "{{Available sizes with sample size in brackets, e.g., XS S [M] L XL}}\n\n" +
              "## Measurements\n" +
              "{{Key measurements in a structured format}}\n\n" +
              "## Bill of Materials\n" +
              "{{BOM Item 1}}\n\n" +
              "{{BOM Item 2}}\n\n" +
              "{{BOM Item 3}}\n\n" +
              "Markdown is supported. Focus on accuracy and professional presentation. Use {{Field Name}} for fields that need to be filled in by the user.",
            messages: [
              {
                role: "user",
                content:
                  "Please analyze this clothing item and create a detailed tech pack following the structured format. Use {{Field Name}} for fields that need to be filled in by the user. DO not add any title or extra categories besides the template",
                experimental_attachments: [imageAttachment],
              },
            ],
            experimental_transform: smoothStream({ chunking: "word" }),
          });

          for await (const delta of fullStream) {
            const { type } = delta;

            if (type === "text-delta") {
              const { textDelta } = delta;

              draftContent += textDelta;

              dataStream.writeData({
                type: "text-delta",
                content: textDelta,
              });
            }
          }

          // Add metadata about fields that need user input
          const fieldsNeedingInput = extractFieldsNeedingInput(draftContent);

          dataStream.writeData({
            type: "fields-needing-input",
            content: fieldsNeedingInput,
          });

          // Save the document with our image included
          if (args.session?.user?.id) {
            await saveDocument({
              id: args.id,
              title: args.title,
              content: draftContent,
              kind: "text",
              userId: args.session.user.id,
            });
          }

          return draftContent;
        },
      };

      // Use our custom handler instead
      await customTextHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
      });

      return {
        id,
        title,
        kind,
        content:
          "I've created a tech pack based on your image. I've identified several fields that need your input. Please look at the form below the chat to fill in these details one by one. As you provide information, I'll update the tech pack document with your input.",
      };
    },
  });

// Function to extract fields that need user input from the content
function extractFieldsNeedingInput(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const fields: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    fields.push(match[1]);
  }

  return [...new Set(fields)]; // Remove duplicates
}
