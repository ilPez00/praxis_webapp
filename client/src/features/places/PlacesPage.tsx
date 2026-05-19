import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import PlacesTab from './PlacesTab';

const PlacesPage: React.FC = () => {
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? undefined);
    });
  }, []);

  return <PlacesTab currentUserId={userId} />;
};

export default PlacesPage;
