import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useArtifact } from "@/hooks/use-artifact";
import { toast } from "sonner";
import { ChatRequestOptions, CreateMessage, Message } from "ai";

interface FieldFillerProps {
  chatId: string;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
}

export function FieldFiller({ chatId, append }: FieldFillerProps) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();
  const [currentFieldIndex, setCurrentFieldIndex] = useState<number>(0);
  const [fieldValue, setFieldValue] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fieldsNeedingInput, setFieldsNeedingInput] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [hasCompletionMessageBeenSent, setHasCompletionMessageBeenSent] =
    useState<boolean>(false);

  // Initialize fields needing input from metadata
  useEffect(() => {
    if (
      metadata?.fieldsNeedingInput &&
      metadata.fieldsNeedingInput.length > 0
    ) {
      setFieldsNeedingInput(metadata.fieldsNeedingInput);
    }
  }, [metadata]);

  // Check if we're done filling all fields
  useEffect(() => {
    if (
      fieldsNeedingInput.length > 0 &&
      currentFieldIndex >= fieldsNeedingInput.length &&
      !hasCompletionMessageBeenSent
    ) {
      setIsComplete(true);
      setHasCompletionMessageBeenSent(true);

      // Send a final message to the AI when all fields are complete
      append({
        role: "user",
        content:
          "I've completed filling in all the required fields. Please review the tech pack and let me know if you have any suggestions for improvements.",
      });

      toast.success("All fields have been filled!");
    }
  }, [
    currentFieldIndex,
    fieldsNeedingInput.length,
    append,
    hasCompletionMessageBeenSent,
  ]);

  // Function to update the artifact content with the new field value
  const updateArtifactContent = (fieldName: string, value: string) => {
    if (!artifact.content) return;

    console.log(`Updating field: ${fieldName} with value: ${value}`);

    // Replace the placeholder with the actual value
    const updatedContent = artifact.content.replace(
      new RegExp(`\\{\\{${fieldName}\\}\\}`, "g"),
      value || `[${fieldName} - Not Provided]` // Use a placeholder for skipped fields
    );

    // Check if the content was actually updated
    if (updatedContent === artifact.content) {
      console.warn(`No replacement occurred for field: ${fieldName}`);
      console.log(`Looking for pattern: {{${fieldName}}}`);
      console.log(
        `Content contains this pattern: ${artifact.content.includes(
          `{{${fieldName}}`
        )}`
      );
    }

    // Update the artifact content immediately
    setArtifact((currentArtifact) => ({
      ...currentArtifact,
      content: updatedContent,
    }));

    // Save the updated content to the server asynchronously
    // We don't need to await this operation
    fetch(`/api/document?id=${artifact.documentId}`, {
      method: "POST",
      body: JSON.stringify({
        title: artifact.title,
        content: updatedContent,
        kind: artifact.kind,
      }),
    }).catch((error) => {
      console.error("Failed to save updated content:", error);
      // We don't show an error toast here since the UI already updated
    });
  };

  // Function to handle submitting a field value
  const handleSubmitField = () => {
    if (currentFieldIndex >= fieldsNeedingInput.length || !fieldValue.trim())
      return;

    const fieldName = fieldsNeedingInput[currentFieldIndex];

    // Update the artifact content immediately
    updateArtifactContent(fieldName, fieldValue);

    // Combine user input and AI acknowledgment into a single message
    // to avoid duplicate key errors
    const acknowledgmentMessage = getAcknowledgmentMessage(
      fieldName,
      fieldValue,
      currentFieldIndex,
      fieldsNeedingInput.length,
      false
    );

    append({
      role: "user",
      content: `For ${fieldName}: ${fieldValue}\n\n**AI Response:** ${acknowledgmentMessage}`,
    });

    // Move to the next field immediately
    setCurrentFieldIndex((prev) => prev + 1);
    setFieldValue("");
  };

  // Function to handle skipping a field
  const handleSkipField = () => {
    if (currentFieldIndex >= fieldsNeedingInput.length) return;

    const fieldName = fieldsNeedingInput[currentFieldIndex];

    // Update the artifact content with a placeholder immediately
    updateArtifactContent(fieldName, "");

    // Combine user input and AI acknowledgment into a single message
    // to avoid duplicate key errors
    const acknowledgmentMessage = getAcknowledgmentMessage(
      fieldName,
      "",
      currentFieldIndex,
      fieldsNeedingInput.length,
      true
    );

    append({
      role: "user",
      content: `I'd like to skip providing the ${fieldName} for now.\n\n**AI Response:** ${acknowledgmentMessage}`,
    });

    // Move to the next field immediately
    setCurrentFieldIndex((prev) => prev + 1);
    setFieldValue("");
  };

  // Function to generate an acknowledgment message based on the field
  const getAcknowledgmentMessage = (
    fieldName: string,
    value: string,
    currentIndex: number,
    totalFields: number,
    skipped: boolean
  ) => {
    const remainingFields = totalFields - currentIndex - 1;

    if (skipped) {
      return `No problem, I've marked ${fieldName} as not provided. ${
        remainingFields > 0
          ? `Let's continue with the next field.`
          : `That was the last field! I'll review the tech pack now.`
      }`;
    }

    // Different responses based on the field type
    if (fieldName.toLowerCase().includes("brand")) {
      return `Thank you for providing the brand name "${value}". ${
        remainingFields > 0
          ? `Let's continue with the next field.`
          : `That was the last field! I'll review the tech pack now.`
      }`;
    } else if (fieldName.toLowerCase().includes("designer")) {
      return `Got it, the designer is "${value}". ${
        remainingFields > 0
          ? `Let's continue with the next field.`
          : `That was the last field! I'll review the tech pack now.`
      }`;
    } else if (fieldName.toLowerCase().includes("description")) {
      return `Thank you for the description. ${
        remainingFields > 0
          ? `Let's continue with the next field.`
          : `That was the last field! I'll review the tech pack now.`
      }`;
    } else if (fieldName.toLowerCase().includes("measurements")) {
      return `I've updated the measurements as provided. ${
        remainingFields > 0
          ? `Let's continue with the next field.`
          : `That was the last field! I'll review the tech pack now.`
      }`;
    } else {
      return `Thank you for providing the ${fieldName.toLowerCase()}. ${
        remainingFields > 0
          ? `Let's continue with the next field.`
          : `That was the last field! I'll review the tech pack now.`
      }`;
    }
  };

  // If there are no fields needing input or we've completed all fields, don't render anything
  if (fieldsNeedingInput.length === 0 || isComplete) {
    return null;
  }

  const currentField = fieldsNeedingInput[currentFieldIndex];
  const isLongField =
    currentField?.toLowerCase().includes("description") ||
    currentField?.toLowerCase().includes("measurements");

  return (
    <div className="p-4 border rounded-md bg-muted/50 mb-4">
      <h3 className="text-lg font-medium mb-2">
        Field {currentFieldIndex + 1} of {fieldsNeedingInput.length}:{" "}
        {currentField}
      </h3>

      <div className="space-y-2">
        <Label htmlFor="field-value">Please provide the {currentField}:</Label>

        {isLongField ? (
          <Textarea
            id="field-value"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder={`Enter ${currentField}...`}
            className="w-full"
            rows={4}
          />
        ) : (
          <Input
            id="field-value"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder={`Enter ${currentField}...`}
            className="w-full"
          />
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleSubmitField}
            disabled={!fieldValue.trim()}
            className="flex-1"
          >
            Submit
          </Button>

          <Button
            onClick={handleSkipField}
            variant="outline"
            className="flex-1"
          >
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
