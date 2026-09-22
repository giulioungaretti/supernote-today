export const localImagePath = (
  uri: string | null | undefined,
): string | null => {
  if (!uri) {
    return null;
  }
  if (uri.startsWith('/')) {
    return uri;
  }
  if (uri.startsWith('file:///')) {
    try {
      return decodeURIComponent(uri.slice('file://'.length));
    } catch {
      return null;
    }
  }
  return null;
};

export const templatePathCandidates = (
  imageUri: string | null | undefined,
  pluginDirectory: string | null | undefined,
  packagedPath: string,
): readonly string[] => {
  const imagePath = localImagePath(imageUri);
  const directory = localImagePath(pluginDirectory);
  return [
    ...new Set([
      ...(imagePath === null ? [] : [imagePath]),
      ...(directory === null
        ? []
        : [`${directory.replace(/\/+$/, '')}/${packagedPath}`]),
    ]),
  ];
};
