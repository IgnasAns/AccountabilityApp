import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  SafeAreaView,
  Modal,
  Platform,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from './src/services/firebase';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('login');
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await fetchUserData(user.uid);
        setCurrentScreen('dashboard');
      } else {
        setUser(null);
        setUserData(null);
        setCurrentScreen('login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchUserData = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUserData({ id: uid, ...userDoc.data() });
      } else {
        const newUserData = {
          email: user?.email || '',
          displayName: user?.displayName || '',
          balance: 1000,
          friends: [],
        };
        await updateDoc(doc(db, 'users', uid), newUserData);
        setUserData({ id: uid, ...newUserData });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.title}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen setCurrentScreen={setCurrentScreen} />;
      case 'signup':
        return <SignupScreen setCurrentScreen={setCurrentScreen} />;
      case 'dashboard':
        return <DashboardScreen setCurrentScreen={setCurrentScreen} userData={userData} />;
      case 'profile':
        return <ProfileScreen setCurrentScreen={setCurrentScreen} userData={userData} />;
      case 'addFriend':
        return <AddFriendScreen setCurrentScreen={setCurrentScreen} userData={userData} setUserData={setUserData} />;
      case 'createPact':
        return <CreatePactScreen setCurrentScreen={setCurrentScreen} userData={userData} />;
      case 'pactDetail':
        return <PactDetailScreen setCurrentScreen={setCurrentScreen} userData={userData} setUserData={setUserData} />;
      default:
        return <DashboardScreen setCurrentScreen={setCurrentScreen} userData={userData} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderScreen()}
    </SafeAreaView>
  );
};

const LoginScreen = ({ setCurrentScreen }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert('Login Error', error.message);
    }
  };

  return (
    <View style={styles.authContainer}>
      <Text style={styles.title}>Pactify</Text>
      <Text style={styles.subtitle}>Login to your account</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
        <Text style={styles.primaryButtonText}>Login</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.secondaryButton} 
        onPress={() => setCurrentScreen('signup')}
      >
        <Text style={styles.secondaryButtonText}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
};

const SignupScreen = ({ setCurrentScreen }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
      
      await addDoc(collection(db, 'users'), {
        uid: userCredential.user.uid,
        email,
        displayName,
        balance: 1000,
        friends: [],
      });
    } catch (error) {
      Alert.alert('Signup Error', error.message);
    }
  };

  return (
    <View style={styles.authContainer}>
      <Text style={styles.title}>Pactify</Text>
      <Text style={styles.subtitle}>Create your account</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleSignup}>
        <Text style={styles.primaryButtonText}>Sign Up</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.secondaryButton} 
        onPress={() => setCurrentScreen('login')}
      >
        <Text style={styles.secondaryButtonText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const DashboardScreen = ({ setCurrentScreen, userData }) => {
  const [pacts, setPacts] = useState([]);

  useEffect(() => {
    if (userData) {
      fetchPacts();
    }
  }, [userData]);

  const fetchPacts = async () => {
    try {
      const pactsQuery = query(
        collection(db, 'pacts'),
        where('creatorUid', '==', userData.id)
      );
      const pactsSnapshot = await getDocs(pactsQuery);
      const pactsData = pactsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPacts(pactsData);
    } catch (error) {
      console.error('Error fetching pacts:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Logout Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => setCurrentScreen('profile')}
          >
            <Text style={styles.headerButtonText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
            <Text style={styles.headerButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balanceText}>Virtual Balance: ${userData?.balance || 0}</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Your Active Pacts</Text>
        {pacts.length === 0 ? (
          <Text style={styles.emptyText}>No pacts yet. Create your first pact!</Text>
        ) : (
          pacts.map(pact => (
            <TouchableOpacity
              key={pact.id}
              style={styles.pactCard}
              onPress={() => {
                global.selectedPact = pact;
                setCurrentScreen('pactDetail');
              }}
            >
              <Text style={styles.pactTitle}>{pact.title}</Text>
              <Text style={styles.pactDescription}>{pact.description}</Text>
              <Text style={styles.pactPenalty}>Penalty: ${pact.penalty}</Text>
              <Text style={styles.pactType}>Type: {pact.type}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={styles.bottomButtons}>
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => setCurrentScreen('createPact')}
        >
          <Text style={styles.fabText}>Create Pact</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ProfileScreen = ({ setCurrentScreen, userData }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setCurrentScreen('dashboard')}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.profileContainer}>
        <Text style={styles.profileName}>{userData?.displayName || 'User'}</Text>
        <Text style={styles.profileEmail}>{userData?.email}</Text>
        <Text style={styles.profileBalance}>Balance: ${userData?.balance || 0}</Text>

        <Text style={styles.sectionTitle}>Friends ({userData?.friends?.length || 0})</Text>
        {userData?.friends?.length === 0 ? (
          <Text style={styles.emptyText}>No friends added yet.</Text>
        ) : (
          userData?.friends?.map((friend, index) => (
            <View key={index} style={styles.friendItem}>
              <Text style={styles.friendName}>{friend.displayName}</Text>
              <Text style={styles.friendEmail}>{friend.email}</Text>
            </View>
          ))
        )}

        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => setCurrentScreen('addFriend')}
        >
          <Text style={styles.primaryButtonText}>Add Friend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AddFriendScreen = ({ setCurrentScreen, userData, setUserData }) => {
  const [email, setEmail] = useState('');

  const handleAddFriend = async () => {
    try {
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (usersSnapshot.empty) {
        Alert.alert('Error', 'No user found with this email');
        return;
      }

      const friendData = usersSnapshot.docs[0].data();
      const friendWithId = { id: usersSnapshot.docs[0].id, ...friendData };

      if (friendData.email === userData.email) {
        Alert.alert('Error', 'You cannot add yourself as a friend');
        return;
      }

      const isAlreadyFriend = userData.friends?.some(friend => friend.email === email);
      if (isAlreadyFriend) {
        Alert.alert('Error', 'This user is already your friend');
        return;
      }

      await updateDoc(doc(db, 'users', userData.id), {
        friends: arrayUnion({
          id: friendWithId.id,
          email: friendData.email,
          displayName: friendData.displayName,
        })
      });

      const updatedUserData = {
        ...userData,
        friends: [...(userData.friends || []), {
          id: friendWithId.id,
          email: friendData.email,
          displayName: friendData.displayName,
        }]
      };
      setUserData(updatedUserData);

      Alert.alert('Success', 'Friend added successfully');
      setEmail('');
      setCurrentScreen('profile');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setCurrentScreen('profile')}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Friend</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Friend's Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter friend's email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        
        <TouchableOpacity style={styles.primaryButton} onPress={handleAddFriend}>
          <Text style={styles.primaryButtonText}>Add Friend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const CreatePactScreen = ({ setCurrentScreen, userData }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [pactType, setPactType] = useState('time-based');
  const [penalty, setPenalty] = useState('');
  const [showFriendModal, setShowFriendModal] = useState(false);

  const handleCreatePact = async () => {
    if (!title || !description || !selectedFriend || !penalty) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await addDoc(collection(db, 'pacts'), {
        creatorUid: userData.id,
        partnerUid: selectedFriend.id,
        title,
        description,
        type: pactType,
        penalty: parseInt(penalty),
        status: 'active',
        createdAt: new Date(),
      });

      Alert.alert('Success', 'Pact created successfully');
      setCurrentScreen('dashboard');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setCurrentScreen('dashboard')}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Pact</Text>
      </View>

      <ScrollView style={styles.formContainer}>
        <Text style={styles.label}>Goal Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Work 9-5 Daily"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Detailed rules of the pact..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Accountability Partner</Text>
        <TouchableOpacity 
          style={styles.input} 
          onPress={() => setShowFriendModal(true)}
        >
          <Text style={selectedFriend ? styles.inputText : styles.placeholder}>
            {selectedFriend ? selectedFriend.displayName : 'Select a friend'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Pact Type</Text>
        <View style={styles.radioContainer}>
          <TouchableOpacity 
            style={styles.radioOption}
            onPress={() => setPactType('time-based')}
          >
            <View style={[styles.radio, pactType === 'time-based' && styles.radioSelected]} />
            <Text style={styles.radioText}>Time-Based Commitment</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.radioOption}
            onPress={() => setPactType('habit-breaking')}
          >
            <View style={[styles.radio, pactType === 'habit-breaking' && styles.radioSelected]} />
            <Text style={styles.radioText}>Habit-Breaking</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Penalty Amount ($)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter penalty amount"
          value={penalty}
          onChangeText={setPenalty}
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleCreatePact}>
          <Text style={styles.primaryButtonText}>Create Pact</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showFriendModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Friend</Text>
            {userData?.friends?.length === 0 ? (
              <Text style={styles.emptyText}>No friends available. Add friends first.</Text>
            ) : (
              userData?.friends?.map((friend, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.friendOption}
                  onPress={() => {
                    setSelectedFriend(friend);
                    setShowFriendModal(false);
                  }}
                >
                  <Text style={styles.friendOptionText}>{friend.displayName}</Text>
                  <Text style={styles.friendOptionEmail}>{friend.email}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowFriendModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const PactDetailScreen = ({ setCurrentScreen, userData, setUserData }) => {
  const pact = global.selectedPact;
  const [proofImage, setProofImage] = useState(null);

  const handleSubmitProof = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setProofImage(result.assets[0]);
      uploadProof(result.assets[0]);
    }
  };

  const uploadProof = async (imageAsset) => {
    try {
      const response = await fetch(imageAsset.uri);
      const blob = await response.blob();
      const imageRef = ref(storage, `proofs/${Date.now()}_${imageAsset.fileName || 'image.jpg'}`);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);

      await addDoc(collection(db, 'reports'), {
        pactId: pact.id,
        reporterUid: userData.id,
        timestamp: new Date(),
        proofImageUrl: downloadURL,
        status: 'pending',
      });

      Alert.alert('Success', 'Proof submitted successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleFailed = async () => {
    Alert.alert(
      'Confirm Failure',
      `This will deduct $${pact.penalty} from your balance and add it to your partner's balance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            try {
              const newBalance = userData.balance - pact.penalty;
              await updateDoc(doc(db, 'users', userData.id), {
                balance: newBalance
              });

              const partnerDoc = await getDoc(doc(db, 'users', pact.partnerUid));
              if (partnerDoc.exists()) {
                const partnerData = partnerDoc.data();
                await updateDoc(doc(db, 'users', pact.partnerUid), {
                  balance: partnerData.balance + pact.penalty
                });
              }

              setUserData({ ...userData, balance: newBalance });

              Alert.alert('Transaction Complete', `$${pact.penalty} has been transferred to your partner.`);
              setCurrentScreen('dashboard');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setCurrentScreen('dashboard')}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pact Details</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.pactDetailCard}>
          <Text style={styles.pactDetailTitle}>{pact.title}</Text>
          <Text style={styles.pactDetailDescription}>{pact.description}</Text>
          <Text style={styles.pactDetailInfo}>Type: {pact.type}</Text>
          <Text style={styles.pactDetailInfo}>Penalty: ${pact.penalty}</Text>
          <Text style={styles.pactDetailInfo}>Status: {pact.status}</Text>
        </View>

        {pact.type === 'time-based' ? (
          <TouchableOpacity style={styles.actionButton} onPress={handleSubmitProof}>
            <Text style={styles.actionButtonText}>Submit Proof of Work</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.actionButton, styles.failButton]} onPress={handleFailed}>
            <Text style={styles.actionButtonText}>I Failed</Text>
          </TouchableOpacity>
        )}

        {proofImage && (
          <View style={styles.proofContainer}>
            <Text style={styles.proofTitle}>Submitted Proof:</Text>
            <Image source={{ uri: proofImage.uri }} style={styles.proofImage} />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  headerButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  backButton: {
    paddingRight: 16,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  balanceContainer: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    alignItems: 'center',
  },
  balanceText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 20,
    color: '#1a1a1a',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 40,
  },
  pactCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pactTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  pactDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pactPenalty: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  pactType: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  bottomButtons: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  fab: {
    backgroundColor: '#007AFF',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileContainer: {
    padding: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  profileEmail: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  profileBalance: {
    fontSize: 18,
    textAlign: 'center',
    color: '#007AFF',
    marginBottom: 32,
    fontWeight: '600',
  },
  friendItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  friendEmail: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  radioContainer: {
    marginBottom: 20,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 12,
  },
  radioSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  radioText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1a1a1a',
  },
  friendOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  friendOptionEmail: {
    fontSize: 14,
    color: '#666',
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  pactDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pactDetailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  pactDetailDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 24,
  },
  pactDetailInfo: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  failButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  proofContainer: {
    padding: 20,
  },
  proofTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
});

export default App;