import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SetDocumentTitle = ({ titles }) => {
  const pathname = useLocation().pathname;

  useEffect(() => {
    document.title = titles[pathname] === undefined ? 'KABAS' : 'KABAS ' + titles[pathname];
  }, [pathname, titles]);
};

export default SetDocumentTitle;