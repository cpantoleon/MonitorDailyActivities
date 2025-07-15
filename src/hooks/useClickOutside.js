import { useEffect, useRef } from 'react';

const useClickOutside = (handler) => {
  const domNode = useRef();

  useEffect(() => {
    const maybeHandler = (event) => {
      const isClickInsideDatePicker = event.target.closest('.react-datepicker-popper');
      const isClickInsideCustomDropdown = event.target.closest('.custom-dropdown-options');
      
      if (domNode.current && !domNode.current.contains(event.target) && !isClickInsideDatePicker && !isClickInsideCustomDropdown) {
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