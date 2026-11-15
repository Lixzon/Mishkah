import React from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { Toggle } from './ui/controls';
import ProfileAvatar from './ui/ProfileAvatar';
import { setAssistantLayout, setFluidAnimations, setProfileAvatar } from '../store/slices/settingsSlice';

export default function MishkahSettings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Mishkah Settings</h1>
      
      {/* Profile Avatar Selection */}
      <section className="rounded-xl bg-card p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold">Profile Avatar</h2>
        <div className="flex items-center space-x-4">
          <ProfileAvatar id={settings.profileAvatar} size={64} />
          <p className="text-sm text-muted-foreground">Select your preferred avatar for your Mishkah profile.</p>
        </div>
      </section>

      {/* App & Assistant Preferences */}
      <section className="rounded-xl bg-card p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <div className="flex items-center justify-between">
          <span>Fluid Animations</span>
          <Toggle 
            checked={settings.enableFluidAnimations} 
            onChange={(checked) => dispatch(setFluidAnimations(checked))} 
          />
        </div>
      </section>
    </div>
  );
}
export { MishkahSettings };
