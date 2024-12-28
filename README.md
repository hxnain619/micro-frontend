# Module Federation with React and Angular

This project demonstrates how to use **Module Federation** to integrate a **React** application and an **Angular** application together. The goal is to expose an Angular component (`AppComponent`) from an Angular remote app to a React host app using **Vite** and **Module Federation**.

## Table of Contents

- [Project Setup](#project-setup)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
- [Folder Structure](#folder-structure)
- [How to Use](#how-to-use)
- [Troubleshooting](#troubleshooting)

## Project Setup

This project consists of two main applications:

1. **React Host App**: The main application that will host the Angular component exposed by the Angular Remote App.
2. **Angular Remote App**: An Angular application that exposes `AppComponent` via Module Federation.

### Technologies Used

- **React**: Frontend library for building user interfaces.
- **Angular**: Framework for building web applications.
- **Vite**: Fast build tool used for both the React and Angular applications.
- **Module Federation**: Webpack 5 feature used to share code between different applications at runtime.
- **@originjs/vite-plugin-federation**: Vite plugin for handling module federation.
- **@angular-architects/module-federation**: Angular library for integrating with module federation.

## Getting Started

Follow the steps below to get the project up and running on your local machine.

### Prerequisites

Before getting started, ensure you have the following installed:

- **Node.js** (version 14.x or later)
- **npm** (Node Package Manager)
- **Angular CLI** (for Angular app setup)
- **Vite** (for React and Angular build tool setup)

### Step 1: Clone the Repository

Clone this repository to your local machine:

```bash
git clone https://github.com/your-username/module-federation-react-angular.git
cd module-federation-react-angular
```

### Step 2: Install Dependencies

For both the **React Host** and **Angular Remote** apps, you need to install dependencies.

- For the **React Host App**:

```bash
cd host-app
npm install
```

- For the **Angular Remote App**:

```bash
cd remote-app
npm install
```

### Step 3: Running the Applications

1. **Start the Angular Remote App**:

```bash
cd remote-app
npm run dev
```

By default, the Angular remote app will be available at `http://localhost:5001`.

2. **Start the React Host App**:

```bash
cd host-app
npm run dev
```

By default, the React host app will be available at `http://localhost:5000`.

The React host app will dynamically load the Angular component (`AppComponent`) from the Angular remote app using **Module Federation**.

## Folder Structure

```bash
├── host-app/                # React Host App
│   ├── src/                 # Source files for the React app
│   ├── vite.config.ts       # Vite config for the host app
│   └── package.json         # Host app dependencies and scripts
│
├── remote-app/              # Angular Remote App
│   ├── src/                 # Source files for the Angular app
│   ├── vite.config.ts       # Vite config for the remote app
│   ├── angular.json         # Angular project config
│   └── package.json         # Remote app dependencies and scripts
│
├── README.md                # Project documentation
└── package.json             # Root-level dependencies and configurations
```

## How to Use

### Expose Angular Component in Remote App

In the `remote-app`, the `AppComponent` is exposed through **Module Federation**:

```typescript
export default defineConfig({
  plugins: [
    federation({
      name: 'remote_app',
      filename: 'remoteEntry.js',
      exposes: {
        './AppComponent': './src/app/app.component.ts',  // Exposing the AppComponent
      },
      shared: [
        '@angular/core',
        '@angular/common',
        '@angular/router',
        '@angular/compiler',
        '@angular/platform-browser',
        '@angular/platform-browser-dynamic',
      ],
    }),
  ],
});
```

## Contributing

Feel free to fork this project, make changes, and create a pull request. We appreciate contributions that can help improve this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
