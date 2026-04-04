import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Wallet, Reward } from '../types.ts'

interface Props {
  wallet: Wallet
  rewards: Reward[]
  onRedeem: (reward: Reward) => Promise<void>
}

export function RewardShop({ wallet, rewards, onRedeem }: Props) {
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null)
  const [redeemedReward, setRedeemedReward] = useState<Reward | null>(null)

  const handleRedeem = async (reward: Reward) => {
    setConfirmReward(null)
    await onRedeem(reward)
    if (reward.type === 'real') {
      setRedeemedReward(reward)
    } else {
      setRedeemedReward(reward)
      setTimeout(() => setRedeemedReward(null), 4000)
    }
  }

  return (
    <>
      <div className="rewards-grid">
        {rewards.map((reward) => {
          const canAfford = wallet.balance >= reward.cost
          const owned = wallet.redeemed_rewards.includes(reward.id)
          return (
            <div key={reward.id} className={`reward-card${!canAfford && !owned ? ' locked' : ''}`}>
              <span className="reward-emoji">{reward.emoji}</span>
              <div className="reward-name">{reward.name}</div>
              <div className="reward-desc">{reward.description}</div>
              <span className={`reward-type-badge ${reward.type}`}>
                {reward.type === 'real' ? 'Real' : 'Virtual'}
              </span>
              <div className="reward-cost">{'\u2B50'} {reward.cost}</div>
              {owned ? (
                <button className="reward-btn owned" disabled>Redeemed</button>
              ) : (
                <button
                  className="reward-btn"
                  disabled={!canAfford}
                  onClick={() => setConfirmReward(reward)}
                >
                  {canAfford ? 'Redeem' : `Need ${reward.cost - wallet.balance} more`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {confirmReward && (
        <div className="modal-overlay" onClick={() => setConfirmReward(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-emoji">{confirmReward.emoji}</span>
            <h3>Redeem {confirmReward.name}?</h3>
            <p className="modal-desc">{confirmReward.description}</p>
            <p className="modal-cost">{'\u2B50'} {confirmReward.cost} tokens</p>
            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => setConfirmReward(null)}>Cancel</button>
              <button className="modal-btn confirm" onClick={() => handleRedeem(confirmReward)}>Redeem!</button>
            </div>
          </div>
        </div>
      )}

      {redeemedReward && (
        <div className="modal-overlay" onClick={() => setRedeemedReward(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-emoji">{redeemedReward.emoji}</span>
            {redeemedReward.type === 'real' ? (
              <>
                <h3>Redeemed!</h3>
                <p className="modal-desc">Show this code to redeem your reward:</p>
                <div className="redemption-code">{redeemedReward.redemption_code}</div>
                <div className="qr-container">
                  <QRCodeSVG value={redeemedReward.redemption_code ?? ''} size={140} bgColor="transparent" fgColor="#ffffff" />
                </div>
                <button className="modal-btn confirm" onClick={() => setRedeemedReward(null)}>Done</button>
              </>
            ) : (
              <>
                <h3>Congratulations!</h3>
                <p className="modal-desc">You unlocked: {redeemedReward.name}</p>
                <button className="modal-btn confirm" onClick={() => setRedeemedReward(null)}>Awesome!</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
