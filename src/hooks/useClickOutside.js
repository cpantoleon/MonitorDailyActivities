import { useEffect, useRef } from 'react';

const useClickOutside = (handler) => {
  const domNode = useRef();

  useEffect(() => {
    const maybeHandler = (event) => {
      if (event.target.closest('.filter-toggle-button')) {
        return;
      }

      const portalSelectors = [
        '.react-datepicker-popper',
        '.custom-dropdown-options',
        '.confirmation-modal-overlay',
        '.add-new-modal-overlay',
        '.history-modal-overlay',
        '.gif-modal-overlay'
      ];

      const portalElement = event.target.closest(portalSelectors.join(','));

      if (domNode.current && !domNode.current.contains(event.target)) {
        if (portalElement && !portalElement.contains(domNode.current)) {
          return;
        }
        handler();
      }
    };

    document.addEventListener("mousedown", maybeHandler);

    return () => {
      document.removeEventListener("mousedown", maybeHandler);
    };
  }, [handler]);

  return domNode;
};

export default useClickOutside;