import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  containerId?: string;
}

export const Portal: React.FC<PortalProps> = ({ children, containerId = 'portal-root' }) => {
  const elRef = useRef<HTMLDivElement | null>(null);
  
  if (!elRef.current) {
    elRef.current = document.createElement('div');
  }
  
  useEffect(() => {
    const portalRoot = document.getElementById(containerId) || document.body;
    const el = elRef.current!;
    
    portalRoot.appendChild(el);
    
    return () => {
      portalRoot.removeChild(el);
    };
  }, [containerId]);
  
  return ReactDOM.createPortal(children, elRef.current);
};