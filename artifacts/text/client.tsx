import { Artifact } from "@/components/create-artifact";
import { DiffView } from "@/components/diffview";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { Editor } from "@/components/text-editor";
import {
  ClockRewind,
  CopyIcon,
  MessageIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
  DownloadIcon,
} from "@/components/icons";
import { Suggestion } from "@/lib/db/schema";
import { toast } from "sonner";
import { getSuggestions } from "../actions";
import html2pdf from "html2pdf.js";

interface TextArtifactMetadata {
  suggestions: Array<Suggestion>;
}

export const textArtifact = new Artifact<"text", TextArtifactMetadata>({
  kind: "text",
  description: "Useful for text content, like drafting essays and emails.",
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

    setMetadata({
      suggestions,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === "suggestion") {
      setMetadata((metadata) => {
        return {
          suggestions: [
            ...metadata.suggestions,
            streamPart.content as Suggestion,
          ],
        };
      });
    }

    if (streamPart.type === "text-delta") {
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + (streamPart.content as string),
          isVisible:
            draftArtifact.status === "streaming" &&
            draftArtifact.content.length > 400 &&
            draftArtifact.content.length < 450
              ? true
              : draftArtifact.isVisible,
          status: "streaming",
        };
      });
    }
  },
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    if (mode === "diff") {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);

      return <DiffView oldContent={oldContent} newContent={newContent} />;
    }

    return (
      <>
        <div className="flex flex-row py-8 md:p-20 px-4">
          <Editor
            content={content}
            suggestions={metadata ? metadata.suggestions : []}
            isCurrentVersion={isCurrentVersion}
            currentVersionIndex={currentVersionIndex}
            status={status}
            onSaveContent={onSaveContent}
          />

          {metadata &&
          metadata.suggestions &&
          metadata.suggestions.length > 0 ? (
            <div className="md:hidden h-dvh w-12 shrink-0" />
          ) : null}
        </div>
      </>
    );
  },
  actions: [
    {
      icon: <ClockRewind size={18} />,
      description: "View changes",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("toggle");
      },
      isDisabled: ({ currentVersionIndex, setMetadata }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
  ],
  toolbar: [
    {
      icon: <PenIcon />,
      description: "Add final polish",
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: "user",
          content:
            "Please add final polish and check for grammar, add section titles for better structure, and ensure everything reads smoothly.",
        });
      },
    },
    {
      icon: <MessageIcon />,
      description: "Request suggestions",
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: "user",
          content:
            "Please add suggestions you have that could improve the writing.",
        });
      },
    },
    {
      icon: <DownloadIcon />,
      description: "Download as PDF",
      onClick: () => {
        // Get the editor content element - this targets the actual content area
        const editorContent = document.querySelector(
          ".ProseMirror" // This targets the ProseMirror editor content
        );

        if (!editorContent) {
          toast.error("Could not find content to convert to PDF");
          return;
        }

        // Show loading toast
        const loadingToast = toast.loading("Generating PDF...");

        // Create a temporary container for PDF generation
        const tempContainer = document.createElement("div");
        tempContainer.className = "pdf-container";
        tempContainer.style.padding = "20px";
        tempContainer.style.backgroundColor = "white";
        tempContainer.style.color = "black";

        // Clone the content to preserve styling
        const clonedContent = editorContent.cloneNode(true) as HTMLElement;

        // Process images in the cloned content to handle them better
        const images = clonedContent.querySelectorAll("img");
        images.forEach((img) => {
          // Add crossOrigin attribute to help with CORS issues
          img.crossOrigin = "anonymous";

          // If the image has a relative path, make it absolute
          if (img.src && img.src.startsWith("/")) {
            img.src = window.location.origin + img.src;
          }

          // Add error handling for images
          img.onerror = () => {
            console.warn(`Failed to load image: ${img.src}`);
            // Replace with a placeholder or remove
            img.style.display = "none";
          };
        });

        tempContainer.appendChild(clonedContent);

        // Add the temp container to the document temporarily
        document.body.appendChild(tempContainer);

        // Configure html2pdf options
        const opt = {
          margin: [15, 15],
          filename: "document.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true, // Enable cross-origin image loading
            allowTaint: true, // Allow tainted canvas
            logging: false, // Disable logging to avoid console spam
            imageTimeout: 5000, // Increase timeout for image loading
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        };

        // Generate PDF from the temporary container
        html2pdf()
          .set(opt)
          .from(tempContainer)
          .save()
          .then(() => {
            toast.dismiss(loadingToast);
            toast.success("PDF downloaded successfully!");
            // Clean up
            tempContainer.remove();
          })
          .catch((error: unknown) => {
            console.error("Error generating PDF:", error);
            toast.dismiss(loadingToast);
            toast.error("Failed to generate PDF");
            // Clean up
            tempContainer.remove();
          });
      },
    },
  ],
});
