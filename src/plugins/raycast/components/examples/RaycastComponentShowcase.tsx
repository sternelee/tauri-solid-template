import { createSignal, Show, For, JSX } from 'solid-js';
import {
  List, ListItem, ListSection, ListEmptyView,
  Detail, DetailMetadata, DetailMetadataLabel, DetailMetadataLink,
  Form, FormTextField, FormTextArea, FormDropdown, FormDropdownItem,
  Grid, GridItem, GridSection,
  Action, ActionPanel, ActionPanelSection, ActionPush, ActionCopyToClipboard, ActionOpenInBrowser,
  CommonShortcuts, ActionStyle
} from '../index';

// ============================================================================
// Raycast Component Showcase
// ============================================================================

export function RaycastComponentShowcase(): JSX.Element {
  const [currentView, setCurrentView] = createSignal<'list' | 'detail' | 'form' | 'grid'>('list');
  const [selectedItem, setSelectedItem] = createSignal<any>(null);

  // Sample data
  const sampleItems = [
    {
      id: '1',
      title: 'Project Alpha',
      subtitle: 'React application with TypeScript',
      icon: '⚛️',
      keywords: ['react', 'typescript', 'frontend'],
      url: 'https://github.com/example/project-alpha'
    },
    {
      id: '2', 
      title: 'API Gateway',
      subtitle: 'Node.js microservice architecture',
      icon: '🚀',
      keywords: ['nodejs', 'api', 'microservice'],
      url: 'https://github.com/example/api-gateway'
    },
    {
      id: '3',
      title: 'Mobile App',
      subtitle: 'React Native cross-platform app',
      icon: '📱',
      keywords: ['react-native', 'mobile', 'ios', 'android'],
      url: 'https://github.com/example/mobile-app'
    }
  ];

  const handleItemSelect = (item: any) => {
    setSelectedItem(item);
    setCurrentView('detail');
  };

  const handleFormSubmit = (values: any) => {
    console.log('Form submitted:', values);
    alert('Form submitted successfully!');
  };

  return (
    <div class="raycast-showcase h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <div class="raycast-showcase-nav bg-gray-100 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex space-x-2">
          <button
            class={`px-3 py-1 rounded text-sm ${currentView() === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            onClick={() => setCurrentView('list')}
          >
            List View
          </button>
          <button
            class={`px-3 py-1 rounded text-sm ${currentView() === 'detail' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            onClick={() => setCurrentView('detail')}
          >
            Detail View
          </button>
          <button
            class={`px-3 py-1 rounded text-sm ${currentView() === 'form' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            onClick={() => setCurrentView('form')}
          >
            Form View
          </button>
          <button
            class={`px-3 py-1 rounded text-sm ${currentView() === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            onClick={() => setCurrentView('grid')}
          >
            Grid View
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="raycast-showcase-content flex-1">
        <Show when={currentView() === 'list'}>
          <ListViewExample items={sampleItems} onItemSelect={handleItemSelect} />
        </Show>

        <Show when={currentView() === 'detail'}>
          <DetailViewExample item={selectedItem() || sampleItems[0]} />
        </Show>

        <Show when={currentView() === 'form'}>
          <FormViewExample onSubmit={handleFormSubmit} />
        </Show>

        <Show when={currentView() === 'grid'}>
          <GridViewExample items={sampleItems} onItemSelect={handleItemSelect} />
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// List View Example
// ============================================================================

function ListViewExample(props: { items: any[]; onItemSelect: (item: any) => void }): JSX.Element {
  return (
    <List
      searchBarPlaceholder="Search projects..."
      onSearchTextChange={(text) => console.log('Search:', text)}
    >
      <ListSection title="Recent Projects" subtitle="Your most recently accessed projects">
        <For each={props.items}>
          {(item) => (
            <ListItem
              id={item.id}
              title={item.title}
              subtitle={item.subtitle}
              icon={item.icon}
              keywords={item.keywords}
              accessories={[
                { text: 'Updated 2h ago' },
                { tag: { value: 'Active', color: '#10B981' } }
              ]}
              actions={
                <ActionPanel>
                  <ActionPanelSection>
                    <ActionPush
                      title="View Details"
                      icon="👁️"
                      target={<div>Detail view for {item.title}</div>}
                      onPush={() => props.onItemSelect(item)}
                      shortcut={CommonShortcuts.ENTER}
                    />
                    <ActionOpenInBrowser
                      title="Open Repository"
                      icon="🌐"
                      url={item.url}
                      shortcut={CommonShortcuts.CMD_O}
                    />
                    <ActionCopyToClipboard
                      title="Copy URL"
                      icon="📋"
                      content={item.url}
                      shortcut={CommonShortcuts.CMD_C}
                    />
                  </ActionPanelSection>
                  <ActionPanelSection title="Danger Zone">
                    <Action
                      title="Delete Project"
                      icon="🗑️"
                      style={ActionStyle.Destructive}
                      onAction={() => alert(`Delete ${item.title}?`)}
                    />
                  </ActionPanelSection>
                </ActionPanel>
              }
            />
          )}
        </For>
      </ListSection>
    </List>
  );
}

// ============================================================================
// Detail View Example
// ============================================================================

function DetailViewExample(props: { item: any }): JSX.Element {
  return (
    <Detail
      navigationTitle={props.item.title}
      markdown={`# ${props.item.title}

${props.item.subtitle}

## Overview
This is a detailed view of the selected project. Here you can see comprehensive information about the project including its description, metadata, and available actions.

## Features
- Modern architecture
- TypeScript support
- Comprehensive testing
- CI/CD pipeline

## Getting Started
\`\`\`bash
git clone ${props.item.url}
cd ${props.item.title.toLowerCase().replace(/\s+/g, '-')}
npm install
npm start
\`\`\`
`}
      metadata={
        <DetailMetadata>
          <DetailMetadataLabel
            title="Status"
            text="Active"
            icon="✅"
          />
          <DetailMetadataLabel
            title="Language"
            text="TypeScript"
            icon="📝"
          />
          <DetailMetadataLabel
            title="Last Updated"
            text="2 hours ago"
            icon="🕒"
          />
          <DetailMetadataLink
            title="Repository"
            target={props.item.url}
            text="View on GitHub"
          />
        </DetailMetadata>
      }
      actions={
        <ActionPanel>
          <ActionOpenInBrowser
            title="Open Repository"
            url={props.item.url}
            shortcut={CommonShortcuts.CMD_O}
          />
          <ActionCopyToClipboard
            title="Copy URL"
            content={props.item.url}
            shortcut={CommonShortcuts.CMD_C}
          />
        </ActionPanel>
      }
    />
  );
}

// ============================================================================
// Form View Example
// ============================================================================

function FormViewExample(props: { onSubmit: (values: any) => void }): JSX.Element {
  return (
    <Form
      navigationTitle="Create New Project"
      onSubmit={props.onSubmit}
    >
      <FormTextField
        id="projectName"
        title="Project Name"
        placeholder="Enter project name"
        info="Choose a descriptive name for your project"
        required
      />

      <FormTextArea
        id="description"
        title="Description"
        placeholder="Describe your project..."
        enableMarkdown
        info="You can use Markdown formatting"
      />

      <FormDropdown
        id="template"
        title="Project Template"
        placeholder="Select a template"
        info="Choose a starting template for your project"
      >
        <FormDropdownItem title="React App" value="react" icon="⚛️" />
        <FormDropdownItem title="Vue.js App" value="vue" icon="💚" />
        <FormDropdownItem title="Node.js API" value="nodejs" icon="🚀" />
        <FormDropdownItem title="Python Flask" value="flask" icon="🐍" />
      </FormDropdown>

      <ActionPanel>
        <Action
          title="Create Project"
          icon="✨"
          onAction={() => {
            // Form submission is handled by the Form component
            console.log('Creating project...');
          }}
          shortcut={CommonShortcuts.CMD_ENTER}
        />
        <Action
          title="Cancel"
          style={ActionStyle.Destructive}
          onAction={() => alert('Cancelled')}
          shortcut={CommonShortcuts.ESC}
        />
      </ActionPanel>
    </Form>
  );
}

// ============================================================================
// Grid View Example
// ============================================================================

function GridViewExample(props: { items: any[]; onItemSelect: (item: any) => void }): JSX.Element {
  return (
    <Grid
      columns={3}
      searchBarPlaceholder="Search projects..."
      navigationTitle="Project Gallery"
    >
      <GridSection title="Active Projects">
        <For each={props.items}>
          {(item) => (
            <GridItem
              id={item.id}
              title={item.title}
              subtitle={item.subtitle}
              content={item.icon}
              keywords={item.keywords}
              accessory={{ text: 'Active' }}
              actions={
                <ActionPanel>
                  <ActionPush
                    title="View Details"
                    target={<div>Detail for {item.title}</div>}
                    onPush={() => props.onItemSelect(item)}
                  />
                  <ActionOpenInBrowser
                    title="Open Repository"
                    url={item.url}
                  />
                </ActionPanel>
              }
            />
          )}
        </For>
      </GridSection>
    </Grid>
  );
}

// ============================================================================
// Export
// ============================================================================

export default RaycastComponentShowcase;