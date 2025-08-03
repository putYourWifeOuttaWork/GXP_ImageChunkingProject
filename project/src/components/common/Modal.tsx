import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Portal } from './Portal';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  showCloseButton?: boolean;
  testId?: string;
}

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  showCloseButton = true,
  testId
}: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);
  
  // Handle click on backdrop only
  const handleBackdropClick = (event: React.MouseEvent) => {
    // Only close if clicking directly on the backdrop
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    'full': 'max-w-full'
  };

  return (
    <Portal>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] animate-fade-in" 
        data-testid={testId}
        onClick={handleBackdropClick}
      >
        <div 
          ref={modalRef}
          className={`bg-white rounded-lg shadow-lg w-full ${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
        {title && (
          <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
            {typeof title === 'string' ? <h2 className="text-xl font-semibold">{title}</h2> : title}
            {showCloseButton && (
              <button 
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close modal"
              >
                <X size={24} />
              </button>
            )}
          </div>
        )}
        {children}
        </div>
      </div>
    </Portal>
  );
};

export default Modal;