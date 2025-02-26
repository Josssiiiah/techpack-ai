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
              "Analyze this clothing item and create a detailed tech pack with specifications, measurements, and material information. Include sections for design details, construction notes, and care instructions. Markdown is supported.",
            messages: [
              {
                role: "user",
                content:
                  "Please analyze this clothing item and create a detailed tech pack.",
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
          "A clothing tech pack analysis document was created with your uploaded image and is now visible to the user.",
      };
    },
  });
