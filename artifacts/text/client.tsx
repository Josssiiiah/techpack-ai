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

        // Get document title if available
        const titleElement = document.querySelector("h1");
        const documentTitle = titleElement
          ? titleElement.textContent || "Document"
          : "Document";

        // Extract structured information from the artifact content
        const extractTechPackInfo = (content: Element) => {
          const info: Record<string, string> = {
            brand: "THE BRAND NAME",
            designer: "CLIENT NAME HERE",
            description: "WOMENSWEAR",
            season: "N/A",
            date: new Date().toISOString().split("T")[0].replace(/-/g, "."),
            mainFabric: "FABRIC",
            styleName: "STYLE NAME HERE",
            styleNumber: "ABC123",
            sizeRange: "XS S [M] L XL XXL",
          };

          // First, try to extract information from the document content directly
          // Look for patterns like "Brand: XYZ" or "Designer: ABC" in paragraphs
          const paragraphs = content.querySelectorAll("p");
          paragraphs.forEach((paragraph) => {
            const text = paragraph.textContent?.trim() || "";

            // Check for key-value pairs in the format "Key: Value"
            const keyValueMatch = text.match(/^([^:]+):\s*(.+)$/);
            if (keyValueMatch) {
              const key = keyValueMatch[1].trim().toLowerCase();
              const value = keyValueMatch[2].trim();

              if (key.includes("brand")) {
                info.brand = value;
              } else if (key.includes("designer")) {
                info.designer = value;
              } else if (key.includes("description")) {
                info.description = value;
              } else if (key.includes("season")) {
                info.season = value;
              } else if (key.includes("fabric") && !key.includes("materials")) {
                info.mainFabric = value;
              } else if (key.includes("style name")) {
                info.styleName = value;
              } else if (
                key.includes("style number") ||
                key.includes("style #")
              ) {
                info.styleNumber = value;
              } else if (key.includes("size")) {
                info.sizeRange = value;
              }
            }
          });

          // Also check headings and their following content
          const headings = content.querySelectorAll("h1, h2, h3, h4, h5, h6");
          headings.forEach((heading) => {
            const text = heading.textContent?.trim() || "";
            const nextElement = heading.nextElementSibling;

            // Skip if the next element is another heading
            if (nextElement && nextElement.tagName.match(/^H[1-6]$/)) {
              return;
            }

            const value = nextElement?.textContent?.trim() || "";

            if (text.toLowerCase().includes("brand")) {
              info.brand = value || info.brand;
            } else if (text.toLowerCase().includes("designer")) {
              info.designer = value || info.designer;
            } else if (text.toLowerCase().includes("description")) {
              info.description = value || info.description;
            } else if (text.toLowerCase().includes("season")) {
              info.season = value || info.season;
            } else if (
              text.toLowerCase().includes("fabric") &&
              !text.toLowerCase().includes("materials")
            ) {
              info.mainFabric = value || info.mainFabric;
            } else if (text.toLowerCase().includes("style name")) {
              info.styleName = value || info.styleName;
            } else if (
              text.toLowerCase().includes("style number") ||
              text.toLowerCase().includes("style #")
            ) {
              info.styleNumber = value || info.styleNumber;
            } else if (text.toLowerCase().includes("size")) {
              info.sizeRange = value || info.sizeRange;
            }
          });

          // Extract bill of materials if available
          const bomItems: Array<{
            item: string;
            description: string;
            color: string;
            code: string;
            qty: string;
            supplier: string;
          }> = [];

          // Look for a bill of materials section
          const bomHeading = Array.from(headings).find(
            (h) =>
              h.textContent?.toLowerCase().includes("bill of materials") ||
              h.textContent?.toLowerCase().includes("materials") ||
              h.textContent?.toLowerCase().includes("bom")
          );

          if (bomHeading) {
            // Try to find a list after the BOM heading
            let currentElement = bomHeading.nextElementSibling;
            while (
              currentElement &&
              !currentElement.matches("h1, h2, h3, h4, h5, h6")
            ) {
              // Check if it's a list item
              if (
                currentElement.tagName === "UL" ||
                currentElement.tagName === "OL"
              ) {
                const items = currentElement.querySelectorAll("li");
                items.forEach((item, index) => {
                  if (index < 11) {
                    // Limit to 11 items (A-K)
                    const text = item.textContent?.trim() || "";
                    // Split by commas or by semicolons
                    const parts = text.includes(";")
                      ? text.split(";").map((part) => part.trim())
                      : text.split(",").map((part) => part.trim());

                    bomItems.push({
                      item: parts[0] || "",
                      description: parts[1] || "",
                      color: parts[2] || "",
                      code: parts[3] || "",
                      qty: parts[4] || "",
                      supplier: parts[5] || "",
                    });
                  }
                });
                break;
              } else if (currentElement.tagName === "P") {
                // Check if paragraph contains material information
                const text = currentElement.textContent?.trim() || "";
                if (text && !text.toLowerCase().includes("bill of materials")) {
                  // Split by commas or by semicolons
                  const parts = text.includes(";")
                    ? text.split(";").map((part) => part.trim())
                    : text.split(",").map((part) => part.trim());

                  if (parts.length >= 2) {
                    bomItems.push({
                      item: parts[0] || "",
                      description: parts[1] || "",
                      color: parts[2] || "",
                      code: parts[3] || "",
                      qty: parts[4] || "",
                      supplier: parts[5] || "",
                    });
                  }
                }
              }
              currentElement = currentElement.nextElementSibling;
            }
          }

          // If no BOM items were found, look for any lists in the document that might contain materials
          if (bomItems.length === 0) {
            const lists = content.querySelectorAll("ul, ol");
            lists.forEach((list) => {
              // Check if this list is likely to be a bill of materials
              const previousElement = list.previousElementSibling;
              const previousText =
                previousElement?.textContent?.toLowerCase() || "";

              if (
                previousText.includes("material") ||
                previousText.includes("fabric") ||
                previousText.includes("bom")
              ) {
                const items = list.querySelectorAll("li");
                items.forEach((item, index) => {
                  if (index < 11) {
                    // Limit to 11 items (A-K)
                    const text = item.textContent?.trim() || "";
                    // Split by commas or by semicolons
                    const parts = text.includes(";")
                      ? text.split(";").map((part) => part.trim())
                      : text.split(",").map((part) => part.trim());

                    bomItems.push({
                      item: parts[0] || "",
                      description: parts[1] || "",
                      color: parts[2] || "",
                      code: parts[3] || "",
                      qty: parts[4] || "",
                      supplier: parts[5] || "",
                    });
                  }
                });
              }
            });
          }

          return { info, bomItems };
        };

        // Extract information from the artifact content
        const { info, bomItems } = extractTechPackInfo(editorContent);

        // Create a template for the PDF
        const pdfTemplate = document.createElement("div");
        pdfTemplate.className = "pdf-template";
        pdfTemplate.style.width = "100%";
        pdfTemplate.style.maxWidth = "800px";
        pdfTemplate.style.margin = "0 auto";
        pdfTemplate.style.backgroundColor = "white";
        pdfTemplate.style.color = "black";
        pdfTemplate.style.fontFamily = "Arial, sans-serif";
        pdfTemplate.style.border = "1px solid #000";

        // Create header bar
        const headerBar = document.createElement("div");
        headerBar.style.display = "flex";
        headerBar.style.justifyContent = "space-between";
        headerBar.style.alignItems = "center";
        headerBar.style.backgroundColor = "#222";
        headerBar.style.color = "white";
        headerBar.style.padding = "8px 15px";
        headerBar.style.fontWeight = "bold";

        // Add company name to left side
        const companyName = document.createElement("div");
        companyName.textContent = "TECHPACKS.CO";
        companyName.style.fontSize = "16px";
        headerBar.appendChild(companyName);

        // Add "COVER SHEET" to right side
        const coverSheet = document.createElement("div");
        coverSheet.textContent = "COVER SHEET";
        coverSheet.style.fontSize = "16px";
        headerBar.appendChild(coverSheet);

        pdfTemplate.appendChild(headerBar);

        // Create info table
        const createInfoTable = () => {
          const table = document.createElement("table");
          table.style.width = "100%";
          table.style.borderCollapse = "collapse";
          table.style.border = "1px solid #000";
          table.style.marginBottom = "0";
          return table;
        };

        // Create table row
        const createTableRow = () => {
          const row = document.createElement("tr");
          row.style.borderBottom = "1px solid #000";
          return row;
        };

        // Create table cell
        const createTableCell = (
          label: string,
          value: string,
          colspan: number = 1
        ) => {
          const cell = document.createElement("td");
          cell.style.border = "1px solid #000";
          cell.style.padding = "8px 10px";
          cell.style.fontSize = "12px";
          if (colspan > 1) {
            cell.colSpan = colspan;
          }

          const labelSpan = document.createElement("span");
          labelSpan.style.fontWeight = "bold";
          labelSpan.textContent = label + ": ";

          const valueSpan = document.createElement("span");
          valueSpan.textContent = value;

          cell.appendChild(labelSpan);
          cell.appendChild(valueSpan);

          return cell;
        };

        // Row 1: Brand, Designer, Description
        const infoTable1 = createInfoTable();
        const row1 = createTableRow();
        row1.appendChild(createTableCell("BRAND", info.brand));
        row1.appendChild(createTableCell("DESIGNER", info.designer));
        row1.appendChild(createTableCell("DESCRIPTION", info.description));
        infoTable1.appendChild(row1);
        pdfTemplate.appendChild(infoTable1);

        // Row 2: Season, Date, Main Fabric
        const infoTable2 = createInfoTable();
        const row2 = createTableRow();
        row2.appendChild(createTableCell("SEASON", info.season));
        row2.appendChild(createTableCell("DATE", info.date));
        row2.appendChild(createTableCell("MAIN FABRIC", info.mainFabric));
        infoTable2.appendChild(row2);
        pdfTemplate.appendChild(infoTable2);

        // Row 3: Style Name, Style #, Size Range
        const infoTable3 = createInfoTable();
        const row3 = createTableRow();
        row3.appendChild(createTableCell("STYLE NAME", info.styleName));
        row3.appendChild(createTableCell("STYLE #", info.styleNumber));
        row3.appendChild(
          createTableCell("SIZE RANGE & [SAMPLE SIZE]", info.sizeRange)
        );
        infoTable3.appendChild(row3);
        pdfTemplate.appendChild(infoTable3);

        // Create content table with two columns
        const contentTable = document.createElement("table");
        contentTable.style.width = "100%";
        contentTable.style.borderCollapse = "collapse";
        contentTable.style.border = "1px solid #000";
        contentTable.style.marginBottom = "0";

        // Content table header row
        const contentHeaderRow = document.createElement("tr");

        const fabricSwatchHeader = document.createElement("th");
        fabricSwatchHeader.textContent = "FABRIC SWATCH";
        fabricSwatchHeader.style.border = "1px solid #000";
        fabricSwatchHeader.style.padding = "8px 10px";
        fabricSwatchHeader.style.backgroundColor = "#f5f5f5";
        fabricSwatchHeader.style.fontWeight = "bold";
        fabricSwatchHeader.style.textAlign = "center";
        fabricSwatchHeader.style.fontSize = "14px";
        contentHeaderRow.appendChild(fabricSwatchHeader);

        const sketchHeader = document.createElement("th");
        sketchHeader.textContent = "SKETCH";
        sketchHeader.style.border = "1px solid #000";
        sketchHeader.style.padding = "8px 10px";
        sketchHeader.style.backgroundColor = "#f5f5f5";
        sketchHeader.style.fontWeight = "bold";
        sketchHeader.style.textAlign = "center";
        sketchHeader.style.fontSize = "14px";
        contentHeaderRow.appendChild(sketchHeader);

        contentTable.appendChild(contentHeaderRow);

        // Content table content row
        const contentRow = document.createElement("tr");

        const fabricSwatchCell = document.createElement("td");
        fabricSwatchCell.style.border = "1px solid #000";
        fabricSwatchCell.style.width = "30%";
        fabricSwatchCell.style.height = "300px";
        fabricSwatchCell.style.verticalAlign = "top";

        const sketchCell = document.createElement("td");
        sketchCell.style.border = "1px solid #000";
        sketchCell.style.width = "70%";
        sketchCell.style.height = "300px";
        sketchCell.style.verticalAlign = "top";

        // Find and place the first image in the sketch cell
        const firstImage = editorContent.querySelector("img");
        if (firstImage) {
          const imageClone = firstImage.cloneNode(true) as HTMLImageElement;
          imageClone.style.maxWidth = "100%";
          imageClone.style.maxHeight = "280px";
          imageClone.style.display = "block";
          imageClone.style.margin = "10px auto";
          imageClone.crossOrigin = "anonymous";

          // If the image has a relative path, make it absolute
          if (imageClone.src && imageClone.src.startsWith("/")) {
            imageClone.src = window.location.origin + imageClone.src;
          }

          sketchCell.appendChild(imageClone);
        }

        contentRow.appendChild(fabricSwatchCell);
        contentRow.appendChild(sketchCell);
        contentTable.appendChild(contentRow);

        pdfTemplate.appendChild(contentTable);

        // Create Bill of Materials header
        const bomHeader = document.createElement("div");
        bomHeader.textContent = "BILL OF MATERIALS";
        bomHeader.style.backgroundColor = "#f5f5f5";
        bomHeader.style.border = "1px solid #000";
        bomHeader.style.borderTop = "none";
        bomHeader.style.padding = "8px 10px";
        bomHeader.style.fontWeight = "bold";
        bomHeader.style.textAlign = "center";
        bomHeader.style.fontSize = "14px";
        pdfTemplate.appendChild(bomHeader);

        // Create Bill of Materials table
        const bomTable = document.createElement("table");
        bomTable.style.width = "100%";
        bomTable.style.borderCollapse = "collapse";
        bomTable.style.border = "1px solid #000";
        bomTable.style.marginBottom = "0";

        // BOM table header row
        const bomHeaderRow = document.createElement("tr");

        const headers = [
          "#",
          "ITEM",
          "DESCRIPTION",
          "COLOR",
          "CODE",
          "QTY",
          "SUPPLIER",
        ];
        const widths = ["5%", "15%", "30%", "15%", "10%", "10%", "15%"];

        headers.forEach((header, index) => {
          const th = document.createElement("th");
          th.textContent = header;
          th.style.border = "1px solid #000";
          th.style.padding = "6px 8px";
          th.style.backgroundColor = "#f5f5f5";
          th.style.fontWeight = "bold";
          th.style.fontSize = "12px";
          th.style.width = widths[index];
          bomHeaderRow.appendChild(th);
        });

        bomTable.appendChild(bomHeaderRow);

        // BOM table content rows
        const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

        letters.forEach((letter, index) => {
          const bomRow = document.createElement("tr");

          // Letter cell
          const letterCell = document.createElement("td");
          letterCell.textContent = letter;
          letterCell.style.border = "1px solid #000";
          letterCell.style.padding = "6px 8px";
          letterCell.style.fontSize = "12px";
          letterCell.style.textAlign = "center";
          bomRow.appendChild(letterCell);

          // Get BOM item data if available
          const bomItem = bomItems[index] || {
            item: "",
            description: "",
            color: "",
            code: "",
            qty: "",
            supplier: "",
          };

          // Add cells with data from bomItems if available
          const cellData = [
            bomItem.item,
            bomItem.description,
            bomItem.color,
            bomItem.code,
            bomItem.qty,
            bomItem.supplier,
          ];

          cellData.forEach((data, cellIndex) => {
            const cell = document.createElement("td");
            cell.textContent = data;
            cell.style.border = "1px solid #000";
            cell.style.padding = "6px 8px";
            cell.style.fontSize = "12px";

            // Add alternating row background
            if (index % 2 === 1) {
              cell.style.backgroundColor = "#f9f9f9";
            }

            bomRow.appendChild(cell);
          });

          bomTable.appendChild(bomRow);
        });

        pdfTemplate.appendChild(bomTable);

        // Create footer
        const footer = document.createElement("div");
        footer.style.backgroundColor = "#222";
        footer.style.color = "white";
        footer.style.padding = "8px 15px";
        footer.style.fontSize = "12px";
        footer.style.textAlign = "center";
        footer.textContent = `© COPYRIGHT OF ${
          info.brand
        } ${new Date().getFullYear()}. THIS DESIGN IS THE PROPERTY OF ${
          info.brand
        }`;
        pdfTemplate.appendChild(footer);

        // Add the template to the document temporarily
        document.body.appendChild(pdfTemplate);

        // Configure html2pdf options
        const opt = {
          margin: [0, 0, 0, 0], // No margins since we have borders
          filename: `${documentTitle}_TechPack.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            imageTimeout: 5000,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true,
          },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        };

        // Generate PDF from the template
        html2pdf()
          .set(opt)
          .from(pdfTemplate)
          .save()
          .then(() => {
            toast.dismiss(loadingToast);
            toast.success("Tech Pack PDF downloaded successfully!");
            // Clean up
            pdfTemplate.remove();
          })
          .catch((error: unknown) => {
            console.error("Error generating PDF:", error);
            toast.dismiss(loadingToast);
            toast.error("Failed to generate PDF");
            // Clean up
            pdfTemplate.remove();
          });
      },
    },
  ],
});
