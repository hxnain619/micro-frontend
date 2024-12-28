import React, { Suspense } from "react";

const RemoteAppComponent = React.lazy(() => import("remote_app/AppComponent"));

const LoadingSpinner = () => (
  <div className="flex justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

const App = () => {
  return (
    <div className="p-4">
      <Suspense fallback={<LoadingSpinner />}>
        <h1>Hey there!!!</h1>
        <RemoteAppComponent />
      </Suspense>
    </div>
  );
};

export default App;
