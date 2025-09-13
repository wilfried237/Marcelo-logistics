import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Trash2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { Input } from './ui/input';
import Image from 'next/image';

interface CustomImageUploaderProps {
  imageFiles: File[];
  setImageFiles: (files: File[]) => void;
  variant?: string;
  maxImages?: number;
}

const CustomImageUploader: React.FC<CustomImageUploaderProps> = ({ 
  imageFiles, 
  setImageFiles,
  variant = "Default",
  maxImages = 5
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Generate preview URLs for the images
  const imagePreviewUrls = imageFiles.map(file => URL.createObjectURL(file));
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      // Only add files up to the maxImages limit
      const availableSlots = maxImages - imageFiles.length;
      if (availableSlots > 0) {
        const filesToAdd = newFiles.slice(0, availableSlots);
        setImageFiles([...imageFiles, ...filesToAdd]);
      }
    }
  };
  
  // Handle file removal
  const removeFile = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles.splice(index, 1);
    setImageFiles(newFiles);
  };
  
  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      // Only add files up to the maxImages limit
      const availableSlots = maxImages - imageFiles.length;
      if (availableSlots > 0) {
        const filesToAdd = newFiles.slice(0, availableSlots);
        setImageFiles([...imageFiles, ...filesToAdd]);
      }
    }
  };
  
  // Check if maximum number of images is reached
  const isMaxImagesReached = imageFiles.length >= maxImages;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">{variant} Images ({imageFiles.length}/{maxImages})</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => inputRef.current?.click()}
          disabled={isMaxImagesReached}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>
      
      {/* Hidden file input */}
      <Input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={isMaxImagesReached}
      />
      
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-md p-4 text-center ${
          dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
        } ${isMaxImagesReached ? "opacity-70" : ""} transition-colors`}
        onDragEnter={isMaxImagesReached ? undefined : handleDrag}
        onDragOver={isMaxImagesReached ? undefined : handleDrag}
        onDragLeave={isMaxImagesReached ? undefined : handleDrag}
        onDrop={isMaxImagesReached ? undefined : handleDrop}
        onClick={isMaxImagesReached ? undefined : () => inputRef.current?.click()}
      >
        {imageFiles.length === 0 ? (
          <div className="py-6 flex flex-col items-center text-gray-500">
            <ImageIcon className="h-12 w-12 mb-2" />
            <p>Drag & drop images here or click to browse</p>
            <p className="text-xs mt-1">Supported formats: JPG, PNG, GIF</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
            {imagePreviewUrls.map((url, index) => (
              <div key={index} className="relative group">
                <div className="w-full aspect-square rounded-md overflow-hidden border bg-gray-50">
                  <Image
                    src={url}
                    alt={`Variant image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="absolute top-1 right-1 bg-white rounded-full p-1 shadow opacity-80 group-hover:opacity-100"
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
            
            {/* Add more image placeholder - only show if not at max */}
            {!isMaxImagesReached && (
              <div 
                className="w-full aspect-square rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
        )}
        
        {isMaxImagesReached && imageFiles.length > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            Maximum number of images reached ({maxImages})
          </p>
        )}
      </div>
      
      {imageFiles.length > 0 && (
        <div className="flex justify-end">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setImageFiles([])}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
};

// Plus icon component for the add more placeholder
const Plus = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export default CustomImageUploader;
