export function showUpdateAvailableBanner(): void {
  if (document.querySelector('.update-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');

  const message = document.createElement('span');
  message.className = 'update-banner__message';
  message.textContent = 'New version is available. Refresh the page';
  banner.appendChild(message);

  const refresh = document.createElement('button');
  refresh.className = 'btn btn--primary update-banner__refresh';
  refresh.textContent = 'Refresh';
  refresh.addEventListener('click', () => location.reload());
  banner.appendChild(refresh);

  const close = document.createElement('button');
  close.className = 'update-banner__close';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.addEventListener('click', () => banner.remove());
  banner.appendChild(close);

  document.body.appendChild(banner);
}
