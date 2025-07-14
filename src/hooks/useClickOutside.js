import { useEffect, useRef } from 'react';

const useClickOutside = (handler) => {
  const domNode = useRef();

  useEffect(() => {
    const maybeHandler = (event) => {
      const isClickInsideDatePicker = event.target.closest('.react-datepicker-popper');
      
      if (domNode.current && !domNode.current.contains(event.target) && !isClickInsideDatePicker) {
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